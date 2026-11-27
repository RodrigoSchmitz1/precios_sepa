// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cotizarLista } from "../api/client";
import { ContextoZona, type EstadoZona } from "../contexto/zona";
import type { ResultadoLista } from "../types";
import type { Zona } from "../utils/zona";
import ProveedorLista from "./ProveedorLista";
import TarjetaTuLista from "./TarjetaTuLista";

/* La tarjeta de tu compra en la portada (openspec app-para-el-usuario; antes lista-en-el-centro). */

vi.mock("../api/client", () => ({ cotizarLista: vi.fn(), obtenerBasicos: vi.fn() }));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const TRES_ARROYOS: Zona = { nombre: "Tres Arroyos", provincia: "AR-B", latitud: -38.37, longitud: -60.27, cadenas: ["Vea", "Dia"] };
const fila = (cadena: string, total: number) => ({ cadena, total, productos_con_precio: 2, completa: true, faltan: [] });
const COTIZACION: ResultadoLista = {
  productos: [{ id_producto: "1" }, { id_producto: "2" }] as ResultadoLista["productos"],
  no_encontrados: [],
  cadenas: [fila("Maxi (Carrefour)", 12000), fila("Vea", 13465)],
  combinando_cadenas: 12000,
  fecha_datos: "2026-11-18",
  zona: { cadenas: [fila("Vea", 13465), fila("Día", 14000)], combinando_cadenas: 13465, no_en_zona: [], mas_barato: {} },
};

function estadoZona(zona: Zona | null): EstadoZona {
  const nada = () => {};
  return { zona, zonas: [], lista: true, aviso: null, elegir: nada, usarUbicacion: nada, ubicando: false, errorUbicacion: null, cerrarAviso: nada };
}

let contenedor: HTMLDivElement;
let raiz: Root;

beforeEach(() => {
  window.localStorage.clear();
  contenedor = document.createElement("div");
  document.body.appendChild(contenedor);
  raiz = createRoot(contenedor);
  vi.mocked(cotizarLista).mockResolvedValue(COTIZACION);
});

afterEach(() => {
  act(() => raiz.unmount());
  contenedor.remove();
  vi.clearAllMocks();
});

async function mostrar(zona: Zona | null) {
  await act(async () => {
    raiz.render(
      <MemoryRouter>
        <ContextoZona.Provider value={estadoZona(zona)}>
          <ProveedorLista>
            <TarjetaTuLista />
          </ProveedorLista>
        </ContextoZona.Provider>
      </MemoryRouter>,
    );
  });
  return (contenedor.textContent ?? "").replace(/[\u00a0\u202f]/g, " ");
}

describe("TarjetaTuLista", () => {
  it("con lista y zona: la más barata entre las cadenas cerca, y lleva a la lista", async () => {
    window.localStorage.setItem("changuito.lista.v1", JSON.stringify([
      { id_producto: "1", nombre: "Yerba", cantidad: 1 },
      { id_producto: "2", nombre: "Aceite", cantidad: 1 },
    ]));
    const texto = await mostrar(TRES_ARROYOS);
    expect(texto).toContain("Tus 2 productos salen $ 13.465 en Vea.");
    expect(texto).toContain("En Día, la siguiente opción, pagás $ 535 más.");
    expect(contenedor.querySelector("a")?.getAttribute("href")).toBe("/lista");
    expect(cotizarLista).toHaveBeenCalledWith(
      [
        { id_producto: "1", cantidad: 1 },
        { id_producto: "2", cantidad: 1 },
      ],
      ["Vea", "Dia"],
    );
  });

  it("sin lista invita con Ver un ejemplo y no cotiza", async () => {
    const texto = await mostrar(TRES_ARROYOS);
    expect(texto).toContain("¿Dónde te conviene tu compra?");
    expect(texto).toContain("Ver un ejemplo");
    expect(cotizarLista).not.toHaveBeenCalled();
  });

  it("la semana siguiente dice cuánto cambió, con la misma lista", async () => {
    const lista = [
      { id_producto: "1", nombre: "Yerba", cantidad: 1 },
      { id_producto: "2", nombre: "Aceite", cantidad: 1 },
    ];
    window.localStorage.setItem("changuito.lista.v1", JSON.stringify(lista));
    // La semana pasada salia $ 14.000 en Vea, con la misma lista y zona.
    window.localStorage.setItem("changuito.lista.semana.v1", JSON.stringify({
      semana: "2000-01-03", huella: "1x1,2x1|Dia,Vea", cadena: "Vea", total: 14000, anterior: null,
    }));
    const texto = await mostrar(TRES_ARROYOS);
    expect(texto).toContain("Esta semana, $ 535 menos que la semana pasada.");
  });

  it("con la compra de ejemplo: cuánto más sale en la siguiente opción", async () => {
    window.localStorage.setItem("changuito.lista.v1", JSON.stringify([
      { id_producto: "1", nombre: "Yerba", cantidad: 1, grupo: "Almacén" },
      { id_producto: "2", nombre: "Aceite", cantidad: 1, grupo: "Almacén" },
    ]));
    window.localStorage.setItem("changuito.lista.ejemplo.v1", "activo");
    const texto = await mostrar(TRES_ARROYOS);
    expect(texto).toContain("Mirá cuánto ahorrás en tu compra");
    expect(texto).toContain("Una compra de ejemplo de 2 productos sale $ 13.465 en Vea.");
    expect(texto).toContain("En Día, la siguiente opción, pagás $ 535 más.");
    expect(contenedor.querySelector("a")?.getAttribute("href")).toBe("/lista");
  });
});

