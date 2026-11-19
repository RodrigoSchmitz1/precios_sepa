// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cotizarLista, interpretarLista } from "../api/client";
import { ContextoZona, type EstadoZona } from "../contexto/zona";
import { useLista } from "../contexto/lista";
import type { ResultadoLista, RenglonInterpretado } from "../types";
import ListaRecibida from "./ListaRecibida";
import PegarLista from "./PegarLista";
import ProveedorLista from "./ProveedorLista";

/* Compartir y pegar la lista (openspec compartir-y-pegar-la-lista). */

vi.mock("../api/client", () => ({ cotizarLista: vi.fn(), interpretarLista: vi.fn() }));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const producto = (id: string, descripcion: string) =>
  ({ id_producto: id, descripcion, marca: null, categoria: "Yerba mate", cadenas: 2, empresas: 2, precio_mas_bajo: 1, precio_mas_alto: 2, diferencia_pct: 1 }) as ResultadoLista["productos"][number];
const fila = (cadena: string, total: number) => ({ cadena, total, productos_con_precio: 2, completa: true, faltan: [] });
const COTIZACION: ResultadoLista = {
  productos: [
    { ...producto("1", "YERBA PLAYADITO 1KG"), cantidad: 2, mas_barato: { cadena: "Dia", precio: 3000 } },
    { ...producto("2", "ACEITE NATURA 1.5L"), cantidad: 1, mas_barato: { cadena: "Dia", precio: 2000 } },
  ],
  no_encontrados: ["999"],
  cadenas: [fila("Dia", 8000), fila("Coto", 9000)],
  combinando_cadenas: 8000,
  fecha_datos: "2026-11-19",
};
const RECIBIDOS = [
  { id_producto: "1", cantidad: 2 },
  { id_producto: "2", cantidad: 1 },
  { id_producto: "999", cantidad: 1 },
];

function estadoZona(): EstadoZona {
  const nada = () => {};
  return { zona: null, zonas: [], lista: true, aviso: null, elegir: nada, usarUbicacion: nada, ubicando: false, errorUbicacion: null, cerrarAviso: nada };
}

function VerLista() {
  const { lista } = useLista();
  return <output data-lista={JSON.stringify(lista.map((i) => [i.id_producto, i.cantidad]))} />;
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

async function mostrar(hijo: React.ReactNode) {
  await act(async () => {
    raiz.render(
      <MemoryRouter>
        <ContextoZona.Provider value={estadoZona()}>
          <ProveedorLista>
            {hijo}
            <VerLista />
          </ProveedorLista>
        </ContextoZona.Provider>
      </MemoryRouter>,
    );
  });
}

const listaGuardada = () => JSON.parse(contenedor.querySelector("output")?.getAttribute("data-lista") ?? "[]");
const texto = () => (contenedor.textContent ?? "").replace(/[\u00a0\u202f]/g, " ");
const boton = (nombre: string) => [...contenedor.querySelectorAll("button")].find((b) => b.textContent?.includes(nombre))!;

describe("una lista recibida por link", () => {
  it("sin lista propia se guarda directo, sin el producto que ya no existe", async () => {
    const listo = vi.fn();
    await mostrar(<ListaRecibida recibidos={RECIBIDOS} onListo={listo} />);
    expect(listaGuardada()).toEqual([
      ["1", 2],
      ["2", 1],
    ]);
    expect(listo).toHaveBeenCalled();
  });

  it("con lista propia no la toca hasta elegir, y sumar deja la cantidad mayor", async () => {
    window.localStorage.setItem("changuito.lista.v1", JSON.stringify([{ id_producto: "1", nombre: "Yerba", cantidad: 5 }, { id_producto: "7", nombre: "Pan", cantidad: 1 }]));
    await mostrar(<ListaRecibida recibidos={RECIBIDOS} onListo={() => {}} />);
    expect(texto()).toContain("Te compartieron una lista de 2 productos");
    expect(texto()).toContain("En Dia sale $ 8.000");
    expect(texto()).toContain("Un producto de la lista ya no tiene precio");
    expect(listaGuardada()).toEqual([
      ["1", 5],
      ["7", 1],
    ]);
    await act(async () => boton("Sumar a mi lista").click());
    expect(listaGuardada()).toEqual([
      ["1", 5],
      ["7", 1],
      ["2", 1],
    ]);
  });

  it("reemplazar deja solo la recibida", async () => {
    window.localStorage.setItem("changuito.lista.v1", JSON.stringify([{ id_producto: "7", nombre: "Pan", cantidad: 1 }]));
    await mostrar(<ListaRecibida recibidos={RECIBIDOS} onListo={() => {}} />);
    await act(async () => boton("Reemplazar mi lista").click());
    expect(listaGuardada()).toEqual([
      ["1", 2],
      ["2", 1],
    ]);
  });
});

describe("pegar una lista escrita", () => {
  const RENGLONES: RenglonInterpretado[] = [
    { texto: "2 leches", busqueda: "leches", cantidad: 2, candidatos: [producto("10", "LECHE ENTERA 1L"), producto("11", "LECHE DESCREMADA 1L")] },
    { texto: "yerba", busqueda: "yerba", cantidad: 1, candidatos: [producto("1", "YERBA PLAYADITO 1KG")] },
    { texto: "xzqw", busqueda: "xzqw", cantidad: 1, candidatos: [] },
  ];

  it("muestra cada renglón, deja cambiar la opción y suma con las cantidades", async () => {
    vi.mocked(interpretarLista).mockResolvedValue(RENGLONES);
    await mostrar(<PegarLista />);
    const area = contenedor.querySelector("textarea")!;
    await act(async () => {
      const set = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!;
      set.call(area, "2 leches\nyerba\nxzqw");
      area.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await act(async () => contenedor.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })));
    expect(interpretarLista).toHaveBeenCalledWith("2 leches\nyerba\nxzqw");
    expect(texto()).toContain("No encontramos este producto");
    const selector = contenedor.querySelector("select")!;
    await act(async () => {
      selector.value = "1";
      selector.dispatchEvent(new Event("change", { bubbles: true }));
    });
    await act(async () => boton("Sumar 2 a mi lista").click());
    expect(listaGuardada()).toEqual([
      ["11", 2],
      ["1", 1],
    ]);
    expect(texto()).toContain("Se sumaron 2 productos");
  });
});
