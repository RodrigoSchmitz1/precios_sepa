// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, Route, Routes } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { obtenerPromosDeProductos, obtenerPromosMapa, obtenerVidriera } from "../api/client";
import { ContextoZona, type EstadoZona } from "../contexto/zona";
import type { PromoCerca, PromoMapa, PromoVidriera, Vidriera } from "../types";
import { alternarAviso } from "../utils/avisos";
import type { Zona } from "../utils/zona";
import PromosPage from "../pages/PromosPage";
import PromosRubroPage from "../pages/PromosRubroPage";
import BotonAvisame from "./BotonAvisame";

/* La vidriera de Promos, los avisos y la pagina de una categoria (openspec promos-navegables-y-mes-en-gastos). */

vi.mock("../api/client", () => ({
  obtenerVidriera: vi.fn(),
  obtenerPromosMapa: vi.fn(),
  obtenerPromosDeProductos: vi.fn(),
  obtenerLugares: vi.fn(() => Promise.resolve([])),
}));
// La presentacion de la portada tiene sus propios pedidos y tests.
vi.mock("./Presentacion", () => ({ default: () => null }));
vi.mock("./VistaMapaPromos", () => ({ default: () => <p>MAPA ABIERTO</p> }));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const ZONA: Zona = { nombre: "Caballito", provincia: "AR-C", latitud: -34.62, longitud: -58.44, cadenas: ["Dia", "Carrefour", "Coto"] };

function estadoZona(zona: Zona | null): EstadoZona {
  const nada = () => {};
  return { zona, zonas: [], lista: true, aviso: null, elegir: nada, usarUbicacion: nada, ubicando: false, errorUbicacion: null, cerrarAviso: nada };
}

const promo = (id: string, extra: Partial<PromoVidriera> = {}): PromoVidriera => ({
  id_producto: id, descripcion: `PRODUCTO ${id}`, marca: "MARCA", categoria: "Lavandina", rubro: "Limpieza", cadena: "Día",
  nombre_sucursal: "Suc 1", calle: "Rivadavia", numero: "5000", localidad: "Caballito", provincia: "AR-C", latitud: 0, longitud: 0,
  precio_lista: 1000, precio_promo: 700, descuento_pct: 30, leyenda: "30% off", nivel_evidencia: "leyenda", sucursales: [1],
  total_sucursales: 8, requiere_compra_multiple: false, vigente_hasta: "2026-11-30", ...extra,
});

const VIDRIERA: Vidriera = {
  con_zona: true, radio_km: 3, total: 120,
  fuertes: [promo("aceite", { descripcion: "ACEITE GIRASOL 1,5 L", descuento_pct: 35 })],
  categorias: [
    ...["Almacen", "Bebidas", "Higiene", "Lacteos", "Panaderia", "Carnes"].map((r, i) => ({ rubro: r, slug: r.toLowerCase(), cantidad: 50 - i, promos: [promo(`${r}1`)] })),
    { rubro: "Limpieza", slug: "limpieza", cantidad: 12, promos: [promo("lavandina")] },
  ],
  cadenas: [{ cadena: "Día", cantidad: 80, promos: [promo("d1")] }],
  poco_informan: ["Coto"],
  sucursales: {},
};

const texto = (el: Element) => (el.textContent ?? "").replace(/\u00a0/g, " ");

let contenedor: HTMLDivElement;
let raiz: Root;

beforeEach(() => {
  window.localStorage.clear();
  contenedor = document.createElement("div");
  document.body.appendChild(contenedor);
  raiz = createRoot(contenedor);
  vi.mocked(obtenerVidriera).mockResolvedValue(structuredClone(VIDRIERA));
  vi.mocked(obtenerPromosDeProductos).mockResolvedValue({});
});

afterEach(() => {
  act(() => raiz.unmount());
  contenedor.remove();
  vi.clearAllMocks();
});

async function mostrar(ruta: string, zona: Zona | null = ZONA) {
  await act(async () => {
    raiz.render(
      <MemoryRouter initialEntries={[ruta]}>
        <ContextoZona.Provider value={estadoZona(zona)}>
          <Routes>
            <Route path="/" element={<PromosPage />} />
            <Route path="/promos/:rubro" element={<PromosRubroPage />} />
          </Routes>
        </ContextoZona.Provider>
      </MemoryRouter>,
    );
  });
}

const boton = (t: string) => [...contenedor.querySelectorAll("button")].find((b) => b.textContent?.includes(t));
const enlace = (t: string) => [...contenedor.querySelectorAll("a")].find((a) => a.textContent?.includes(t));

describe("Promos como vidriera", () => {
  it("abre con las promos del día y filas por categoría y por súper, sin el mapa", async () => {
    await mostrar("/");
    expect(obtenerVidriera).toHaveBeenCalledWith(ZONA);
    expect(obtenerPromosMapa).not.toHaveBeenCalled();
    const t = texto(contenedor);
    expect(t).toContain("Las promos del día");
    expect(t).toContain("cerca de Caballito");
    expect(t).toContain("Aceite girasol 1,5 l");
    expect(t).toContain("Almacén · 50 promos");
    expect(t).toContain("Lo mejor de Día hoy");
    expect(t).toContain("Coto casi no informa promos en SEPA");
    expect(t).not.toContain("MAPA ABIERTO");
    expect(enlace("Ver todas")?.getAttribute("href")).toBe("/promos/almacen");
  });

  it("las categorías que no entran van detrás de un botón", async () => {
    await mostrar("/");
    expect(texto(contenedor)).not.toContain("Limpieza");
    await act(async () => boton("Ver todas las categorías")!.click());
    expect(texto(contenedor)).toContain("Limpieza · 12 promos");
  });

  it("sin zona: todo el país y la invitación a elegirla", async () => {
    await mostrar("/", null);
    expect(obtenerVidriera).toHaveBeenCalledWith(null);
    expect(texto(contenedor)).toContain("Estás viendo promos de todo el país");
  });

  it("el mapa se abre con ?mapa=1", async () => {
    await mostrar("/?mapa=1");
    // React.lazy resuelve en una vuelta mas.
    await act(async () => {});
    expect(texto(contenedor)).toContain("MAPA ABIERTO");
    expect(obtenerVidriera).not.toHaveBeenCalled();
    expect(enlace("Volver a la vidriera")).toBeTruthy();
  });
});

describe("Avisos de oferta", () => {
  const promoCerca: PromoCerca = {
    id_producto: "aceite", descripcion: "ACEITE GIRASOL", cadena: "Día", nombre_sucursal: "Suc", calle: "Rivadavia", numero: "5000",
    barrio: null, localidad: "Caballito", provincia: "AR-C", latitud: 0, longitud: 0, distancia_km: 0.5, otras_sucursales_cerca: 2,
    precio_lista: 3000, precio_promo: 2000, descuento_pct: 33, leyenda: null, nivel_evidencia: "leyenda", vigente_hasta: "2026-11-30",
    requiere_compra_multiple: false,
  };

  it("al volver, dice cuáles están de oferta cerca", async () => {
    alternarAviso({ id_producto: "aceite", descripcion: "ACEITE GIRASOL" }, "2026-11-20");
    alternarAviso({ id_producto: "yerba", descripcion: "YERBA" }, "2026-11-20");
    vi.mocked(obtenerPromosDeProductos).mockResolvedValue({ aceite: [promoCerca] });
    await mostrar("/");
    expect(obtenerPromosDeProductos).toHaveBeenCalledWith(["aceite", "yerba"], ZONA);
    const t = texto(contenedor);
    expect(t).toContain("1 de tus avisos está de oferta cerca");
    expect(t).toContain("$ 2.000");
  });

  it("ninguno en promo: una línea chica, sin bloque", async () => {
    alternarAviso({ id_producto: "yerba", descripcion: "YERBA" }, "2026-11-20");
    await mostrar("/");
    expect(texto(contenedor)).toContain("Tenés 1 aviso: todavía no está de oferta cerca");
    expect(contenedor.querySelector("#titulo-avisos")).toBeNull();
  });

  it("sin zona: invita a elegirla y no busca", async () => {
    alternarAviso({ id_producto: "yerba", descripcion: "YERBA" }, "2026-11-20");
    await mostrar("/", null);
    expect(texto(contenedor)).toContain("Elegí tu zona arriba y te decimos cuáles están de oferta cerca");
    expect(obtenerPromosDeProductos).not.toHaveBeenCalled();
  });

  it("se pueden ver y sacar", async () => {
    alternarAviso({ id_producto: "a", descripcion: "A" }, "2026-11-20");
    alternarAviso({ id_producto: "b", descripcion: "B" }, "2026-11-20");
    await mostrar("/");
    await act(async () => boton("Ver tus 2 avisos")!.click());
    await act(async () => contenedor.querySelector<HTMLButtonElement>('[aria-label="Dejar de avisar A"]')!.click());
    expect(texto(contenedor)).toContain("Tenés 1 aviso");
  });

  it("el botón alterna Avisame / Te avisamos", async () => {
    await act(async () => {
      raiz.render(<BotonAvisame producto={{ id_producto: "x", descripcion: "X" }} />);
    });
    expect(texto(contenedor)).toContain("Avisame cuando esté de oferta");
    await act(async () => boton("Avisame")!.click());
    expect(texto(contenedor)).toContain("Te avisamos");
    expect(boton("Te avisamos")!.getAttribute("aria-pressed")).toBe("true");
    await act(async () => boton("Te avisamos")!.click());
    expect(texto(contenedor)).toContain("Avisame cuando esté de oferta");
  });
});

describe("Página de una categoría", () => {
  const filas: PromoMapa[] = [
    promo("l1", { categoria: "Lavandina" }),
    promo("l2", { categoria: "Detergente", descripcion: "DETERGENTE LIMON" }),
  ];

  it("trae solo ese rubro cerca de la zona, con filtro de subcategoría y Avisame", async () => {
    vi.mocked(obtenerPromosMapa).mockResolvedValue({ promos: filas, hay_mas: false, sucursales: {} });
    await mostrar("/promos/limpieza");
    // El pedido sale en un setTimeout (con busqueda espera 300 ms; sin busqueda, 0).
    await act(async () => new Promise((listo) => setTimeout(listo, 10)));
    expect(obtenerPromosMapa).toHaveBeenCalledWith(
      expect.objectContaining({ rubro: "limpieza", cerca: { latitud: ZONA.latitud, longitud: ZONA.longitud } }),
    );
    expect(texto(contenedor)).toContain("Promos de Limpieza");
    expect(texto(contenedor)).toContain("Todas las promos · 2 promos");
    expect([...contenedor.querySelectorAll("button")].filter((b) => b.textContent?.includes("Avisame"))).toHaveLength(2);
    await act(async () => boton("Detergente")!.click());
    expect(texto(contenedor)).toContain("Detergente · 1 promo");
    expect(texto(contenedor)).not.toContain("Producto l1");
  });

  it("sin promos cerca: lo dice y ofrece volver", async () => {
    vi.mocked(obtenerPromosMapa).mockResolvedValue({ promos: [], hay_mas: false, sucursales: {} });
    await mostrar("/promos/bebes");
    // El pedido sale en un setTimeout (con busqueda espera 300 ms; sin busqueda, 0).
    await act(async () => new Promise((listo) => setTimeout(listo, 10)));
    expect(texto(contenedor)).toContain("No hay promos de Bebés cerca de Caballito");
    expect(enlace("Volver a la vidriera")?.getAttribute("href")).toBe("/");
  });
});
