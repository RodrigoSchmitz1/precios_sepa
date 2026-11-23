// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cotizarLista, dondeComprarLista, leerTicket } from "../api/client";
import { ContextoZona, type EstadoZona } from "../contexto/zona";
import type { Gasto, LineaGasto, ResultadoLista, TicketLeido } from "../types";
import { achicarFoto } from "../utils/fotos";
import { guardarConstantes, guardarGastos, leerGastos } from "../utils/gastos";
import type { Zona } from "../utils/zona";
import GastosPage from "./GastosPage";

/* Mis gastos (openspec mis-gastos-y-barra-nueva). */

vi.mock("../api/client", () => ({ leerTicket: vi.fn(), cotizarLista: vi.fn(), dondeComprarLista: vi.fn() }));
vi.mock("../utils/fotos", () => ({ achicarFoto: vi.fn() }));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const ZONA: Zona = { nombre: "Lomas", provincia: "AR-B", latitud: -34.7, longitud: -58.4, cadenas: ["Coto", "Dia"] };

function estadoZona(zona: Zona | null): EstadoZona {
  const nada = () => {};
  return { zona, zonas: [], lista: true, aviso: null, elegir: nada, usarUbicacion: nada, ubicando: false, errorUbicacion: null, cerrarAviso: nada };
}

const linea = (descripcion: string, importe: number, id: string | null = null, categoria = "Almacen"): LineaGasto => ({
  descripcion, cantidad: 1, precio_unitario: importe, importe, codigo: id, id_producto: id, nombre: id ? descripcion : null, categoria,
  vinculo: id ? "codigo" : "ninguno",
});

const TICKET: TicketLeido = {
  cadena: "COTO", cadenas_sepa: ["Coto"], sucursal: "SUC68", fecha: "2026-11-20", comprobante: "2068-1", total: 43900,
  lineas: [linea("LECHE", 30000, "1"), linea("PAN", 11500, "2")],
  descuentos: [{ descripcion: "PROMO", importe: 300 }],
};

const texto = (el: Element) => (el.textContent ?? "").replace(/\u00a0/g, " ");

let contenedor: HTMLDivElement;
let raiz: Root;

beforeEach(() => {
  window.localStorage.clear();
  contenedor = document.createElement("div");
  document.body.appendChild(contenedor);
  raiz = createRoot(contenedor);
  vi.mocked(achicarFoto).mockResolvedValue("Zm90bw==");
  vi.mocked(dondeComprarLista).mockResolvedValue({ radio_km: 3, productos: 0, sin_precio_cerca: [], opciones: [] });
  vi.mocked(leerTicket).mockResolvedValue({ legible: true, ticket: TICKET, constantes: { maximo_fotos: 3, cobertura_minima_comparacion: 0.6 } });
});

afterEach(() => {
  act(() => raiz.unmount());
  contenedor.remove();
  vi.clearAllMocks();
});

async function mostrar(zona: Zona | null = ZONA) {
  await act(async () => {
    raiz.render(
      <MemoryRouter>
        <ContextoZona.Provider value={estadoZona(zona)}>
          <GastosPage />
        </ContextoZona.Provider>
      </MemoryRouter>,
    );
  });
}

const boton = (texto: string) =>
  [...contenedor.querySelectorAll("button")].find((b) => b.textContent?.includes(texto)) as HTMLButtonElement | undefined;

async function tocar(texto: string) {
  const b = boton(texto);
  if (!b) throw new Error(`No hay botón "${texto}"`);
  await act(async () => b.click());
}

async function elegirFoto() {
  const entrada = contenedor.querySelector<HTMLInputElement>("input[type=file]")!;
  const archivo = new File(["x"], "ticket.jpg", { type: "image/jpeg" });
  Object.defineProperty(entrada, "files", { value: [archivo], configurable: true });
  await act(async () => entrada.dispatchEvent(new Event("change", { bubbles: true })));
}

function escribir(campo: HTMLInputElement, valor: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
  act(() => {
    setter.call(campo, valor);
    campo.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

describe("Mis gastos", () => {
  it("primera visita: explica y ofrece las dos formas de cargar", async () => {
    await mostrar();
    expect(texto(contenedor)).toContain("Mis gastos");
    expect(boton("Sacar foto del ticket")).toBeTruthy();
    expect(boton("Anotar un monto")).toBeTruthy();
  });

  it("el aviso aparece solo la primera vez", async () => {
    await mostrar();
    const click = vi.spyOn(HTMLInputElement.prototype, "click").mockImplementation(() => {});
    await tocar("Sacar foto del ticket");
    expect(texto(contenedor)).toContain("no se guarda");
    expect(click).not.toHaveBeenCalled();
    await tocar("Entendido, sacar la foto");
    expect(click).toHaveBeenCalledTimes(1);
    await tocar("Sacar foto del ticket");
    expect(click).toHaveBeenCalledTimes(2);
    expect(texto(contenedor)).not.toContain("Antes de la primera foto");
  });

  it("revisión: avisa lo que falta y no guarda sin confirmar", async () => {
    await mostrar();
    vi.spyOn(HTMLInputElement.prototype, "click").mockImplementation(() => {});
    await tocar("Sacar foto del ticket");
    await tocar("Entendido, sacar la foto");
    await elegirFoto();
    expect(leerTicket).toHaveBeenCalledWith(["Zm90bw=="]);
    expect(texto(contenedor)).toContain("Revisá el ticket");
    expect(texto(contenedor)).toContain("Faltan $ 2.700 de líneas");
    expect(leerGastos()).toEqual([]);
    await tocar("Guardar");
    const guardados = leerGastos();
    expect(guardados).toHaveLength(1);
    expect(guardados[0]).toMatchObject({ origen: "foto", cadena: "COTO", total: 43900, comprobante: "2068-1" });
    expect(texto(contenedor)).toContain("Ahorraste $ 300 en promos");
  });

  it("un ticket ya cargado pide confirmación antes de duplicarlo", async () => {
    guardarGastos([{ id: "a", origen: "foto", cadena: "COTO", cadenas_sepa: ["Coto"], sucursal: null, fecha: "2026-11-20", comprobante: "2068-1", total: 43900, lineas: [], descuentos: [], creado: 0 }]);
    window.localStorage.setItem("changuito.gastos.aviso.v1", "1");
    await mostrar();
    vi.spyOn(HTMLInputElement.prototype, "click").mockImplementation(() => {});
    await tocar("Sacar foto del ticket");
    await elegirFoto();
    await tocar("Guardar");
    expect(texto(contenedor)).toContain("Este ticket ya está cargado");
    expect(leerGastos()).toHaveLength(1);
    await tocar("Guardar igual");
    expect(leerGastos()).toHaveLength(2);
  });

  it("foto ilegible ofrece otra foto o anotar el monto", async () => {
    window.localStorage.setItem("changuito.gastos.aviso.v1", "1");
    vi.mocked(leerTicket).mockResolvedValue({ legible: false });
    await mostrar();
    vi.spyOn(HTMLInputElement.prototype, "click").mockImplementation(() => {});
    await tocar("Sacar foto del ticket");
    await elegirFoto();
    expect(texto(contenedor)).toContain("No pudimos leer el ticket");
    expect(boton("Sacar otra foto")).toBeTruthy();
    expect(boton("Anotar el monto")).toBeTruthy();
  });

  it("límite de pedidos: muestra el mensaje y deja reintentar con las mismas fotos", async () => {
    window.localStorage.setItem("changuito.gastos.aviso.v1", "1");
    vi.mocked(leerTicket).mockRejectedValueOnce(new Error("Hay muchos tickets leyéndose al mismo tiempo. Probá de nuevo en un minuto."));
    await mostrar();
    vi.spyOn(HTMLInputElement.prototype, "click").mockImplementation(() => {});
    await tocar("Sacar foto del ticket");
    await elegirFoto();
    expect(texto(contenedor)).toContain("Probá de nuevo en un minuto");
    await tocar("Probar de nuevo");
    expect(leerTicket).toHaveBeenCalledTimes(2);
    expect(vi.mocked(leerTicket).mock.calls[1][0]).toEqual(["Zm90bw=="]);
  });

  it("anotar un monto suma al mes y al súper, en Sin detalle", async () => {
    await mostrar();
    await tocar("Anotar un monto");
    const [supers, fecha, monto] = [...contenedor.querySelectorAll<HTMLInputElement>("form input")];
    escribir(supers, "Carrefour");
    escribir(fecha, "2026-11-20");
    escribir(monto, "25.000");
    await tocar("Guardar");
    expect(leerGastos()[0]).toMatchObject({ origen: "mano", cadena: "Carrefour", total: 25000 });
    expect(texto(contenedor)).toContain("En noviembre gastaste $ 25.000");
    expect(texto(contenedor)).toContain("Sin detalle");
  });

  it("un mes con tickets: total, comparación con el anterior y por súper", async () => {
    const g = (cadena: string, fecha: string, total: number): Gasto => ({
      id: `${cadena}${fecha}`, origen: "foto", cadena, cadenas_sepa: [cadena], sucursal: null, fecha, comprobante: null, total,
      lineas: [linea("X", total)], descuentos: [], creado: 0,
    });
    guardarGastos([g("Coto", "2026-11-03", 120000), g("Dia", "2026-11-10", 60000), g("Coto", "2026-10-15", 150000)]);
    await mostrar();
    expect(texto(contenedor)).toContain("En noviembre gastaste $ 180.000");
    expect(texto(contenedor)).toContain("20% más que el mes anterior");
    expect(texto(contenedor)).toContain("Por súper");
  });

  it("al abrir un ticket compara con la cadena más barata de la zona", async () => {
    guardarConstantes({ cobertura_minima_comparacion: 0.6 });
    guardarGastos([{
      id: "t", origen: "foto", cadena: "COTO", cadenas_sepa: ["Coto"], sucursal: null, fecha: "2026-11-20", comprobante: null, total: 40000,
      lineas: [linea("A", 20000, "a"), linea("B", 16000, "b"), linea("C", 4000)], descuentos: [], creado: 0,
    }]);
    const cot: ResultadoLista = {
      productos: [], no_encontrados: [], cadenas: [], combinando_cadenas: 0, fecha_datos: null,
      zona: { cadenas: [{ cadena: "Día", total: 31000, productos_con_precio: 2, completa: true, faltan: [] }], combinando_cadenas: 0, no_en_zona: [], mas_barato: {} },
    };
    vi.mocked(cotizarLista).mockResolvedValue(cot);
    await mostrar();
    const detalle = contenedor.querySelector("details.tarjeta") as HTMLDetailsElement;
    await act(async () => {
      detalle.open = true;
      detalle.dispatchEvent(new Event("toggle"));
    });
    expect(cotizarLista).toHaveBeenCalledWith([{ id_producto: "a", cantidad: 1 }, { id_producto: "b", cantidad: 1 }], ["Coto", "Dia"]);
    expect(texto(detalle)).toContain("En Día salían $ 31.000");
    expect(texto(detalle)).toContain("A precio de lista, sin promos");
  });

  it("si la más barata con todo cobra más que el ticket, no dice que compró en la más barata", async () => {
    guardarConstantes({ cobertura_minima_comparacion: 0.6 });
    guardarGastos([{
      id: "t", origen: "foto", cadena: "COTO", cadenas_sepa: ["Coto"], sucursal: null, fecha: "2026-11-20", comprobante: null, total: 6700,
      lineas: [linea("A", 3300, "a"), linea("B", 1900, "b"), linea("C", 1500, "c")], descuentos: [], creado: 0,
    }]);
    vi.mocked(cotizarLista).mockResolvedValue({
      productos: [], no_encontrados: [], cadenas: [], combinando_cadenas: 0, fecha_datos: null,
      zona: { cadenas: [
        { cadena: "Market (Carrefour)", total: 10085, productos_con_precio: 3, completa: true, faltan: [] },
        { cadena: "Coto", total: 8139, productos_con_precio: 2, completa: false, faltan: [] },
      ], combinando_cadenas: 0, no_en_zona: [], mas_barato: {} },
    });
    await mostrar();
    const detalle = contenedor.querySelector("details.tarjeta") as HTMLDetailsElement;
    await act(async () => {
      detalle.open = true;
      detalle.dispatchEvent(new Event("toggle"));
    });
    expect(texto(detalle)).toContain("Ningún súper de tu zona tenía estos productos más baratos");
    expect(texto(detalle)).toContain("Market (Carrefour)");
    expect(texto(detalle)).not.toContain("Compraste en el súper");
  });

  describe("tu mes en los súper de tu zona (promos-navegables-y-mes-en-gastos)", () => {
    const sucursal = (cadena: string, ids: string[], subtotal: number) => ({
      id: cadena, cadena, nombre_sucursal: cadena, direccion: null, localidad: "Lomas", provincia: "AR-B", latitud: 0, longitud: 0,
      distancia_km: 1, subtotal,
      productos: ids.map((id) => ({ id_producto: id, descripcion: id === "a" ? "LECHE" : "PAN", cantidad: 1, precio_unitario: 1, costo: 1 })),
    });
    const conTickets = () => {
      guardarConstantes({ cobertura_minima_comparacion: 0.6 });
      guardarGastos([
        { id: "1", origen: "foto", cadena: "COTO", cadenas_sepa: ["Coto"], sucursal: null, fecha: "2026-11-03", comprobante: "1", total: 30000,
          lineas: [linea("LECHE", 30000, "a")], descuentos: [], creado: 0 },
        { id: "2", origen: "foto", cadena: "COTO", cadenas_sepa: ["Coto"], sucursal: null, fecha: "2026-11-20", comprobante: "2", total: 12000,
          lineas: [linea("PAN", 10000, "b"), linea("BOLSA", 2000)], descuentos: [], creado: 0 },
      ]);
    };

    it("la más barata y mezclando dos", async () => {
      conTickets();
      vi.mocked(dondeComprarLista).mockResolvedValue({
        radio_km: 3, productos: 2, sin_precio_cerca: [],
        opciones: [
          { max_sucursales: 1, total: 36000, productos_cubiertos: 2, distancia_suma_km: 1, sucursales: [sucursal("Día", ["a", "b"], 36000)] },
          { max_sucursales: 2, total: 33000, productos_cubiertos: 2, distancia_suma_km: 2,
            sucursales: [sucursal("Día", ["a"], 25000), sucursal("Coto", ["b"], 8000)] },
        ],
      });
      await mostrar();
      expect(dondeComprarLista).toHaveBeenCalledWith([{ id_producto: "a", cantidad: 1 }, { id_producto: "b", cantidad: 1 }], ZONA.latitud, ZONA.longitud, 3);
      const t = texto(contenedor);
      expect(t).toContain("En Día, tus 2 productos del mes salían $ 36.000: $ 4.000 menos que los $ 40.000");
      expect(t).toContain("A precio de lista, sin promos");
      expect(t).toContain("Mezclando Día y Coto salían $ 33.000, $ 3.000 menos que solo en Día");
      await tocar("Qué llevar de cada uno");
      expect(texto(contenedor)).toContain("En Coto · 1 producto");
    });

    it("sin zona invita a elegirla y no pide nada", async () => {
      conTickets();
      await mostrar(null);
      expect(texto(contenedor)).toContain("Elegí tu zona arriba y te decimos en qué súper te salía más barato");
      expect(dondeComprarLista).not.toHaveBeenCalled();
    });

    it("poco reconocido: lo dice y no compara", async () => {
      guardarConstantes({ cobertura_minima_comparacion: 0.6 });
      guardarGastos([{ id: "1", origen: "foto", cadena: "COTO", cadenas_sepa: ["Coto"], sucursal: null, fecha: "2026-11-03", comprobante: "1",
        total: 50000, lineas: [linea("LECHE", 10000, "a"), linea("VARIOS", 40000)], descuentos: [], creado: 0 }]);
      await mostrar();
      expect(texto(contenedor)).toContain("Reconocimos 20% de lo que compraste este mes");
      expect(dondeComprarLista).not.toHaveBeenCalled();
    });

    it("un mes solo con gastos a mano no muestra la comparación", async () => {
      guardarConstantes({ cobertura_minima_comparacion: 0.6 });
      guardarGastos([{ id: "m", origen: "mano", cadena: "Dia", cadenas_sepa: [], sucursal: null, fecha: "2026-11-03", comprobante: null,
        total: 5000, lineas: [], descuentos: [], creado: 0 }]);
      await mostrar();
      expect(contenedor.querySelector('[aria-label="Tu mes en los súper de tu zona"]')).toBeNull();
    });
  });
});
