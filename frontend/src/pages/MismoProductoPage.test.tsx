// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buscarProductos, obtenerProductosDestacados } from "../api/client";
import ProveedorLista from "../components/ProveedorLista";
import { ContextoZona, type EstadoZona } from "../contexto/zona";
import type { ProductoComparado } from "../types";
import MismoProductoPage from "./MismoProductoPage";

/* Buscar sin repetir la lista y con el titular de sus resultados (openspec app-para-el-usuario). */

vi.mock("../api/client", () => ({
  buscarProductos: vi.fn(),
  obtenerProducto: vi.fn(() => new Promise(() => {})),
  obtenerProductosDestacados: vi.fn(),
  obtenerAhorroPorCategoria: vi.fn(() => new Promise(() => {})),
  obtenerCadenasDeOtroDia: vi.fn(() => Promise.resolve({ cadenas: [] })),
  cotizarLista: vi.fn(() => new Promise(() => {})),
  obtenerBasicos: vi.fn(),
}));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const producto = (id: string, descripcion: string, diferencia_pct: number): ProductoComparado =>
  ({
    id_producto: id, descripcion, marca: "Playadito", categoria: "Yerba mate", cadenas: 15, empresas: 10,
    precio_mas_bajo: 2000, precio_mas_alto: 2000 * (1 + diferencia_pct / 100), diferencia_pct,
    cantidad_normalizada: 500, unidad_normalizada: "g", cadenas_descartadas: 0, extremos_respaldados: true,
  }) as ProductoComparado;

const PLAYADITO = [28, 37, 94, 83, 31, 58].map((d, i) => producto(String(i + 1), `YERBA PLAYADITO ${i}`, d));

const nada = () => {};
const ZONA: EstadoZona = { zona: null, zonas: [], lista: true, aviso: null, elegir: nada, usarUbicacion: nada, ubicando: false, errorUbicacion: null, cerrarAviso: nada };

let contenedor: HTMLDivElement;
let raiz: Root;

beforeEach(() => {
  window.localStorage.clear();
  contenedor = document.createElement("div");
  document.body.appendChild(contenedor);
  raiz = createRoot(contenedor);
  vi.mocked(buscarProductos).mockResolvedValue(PLAYADITO);
  vi.mocked(obtenerProductosDestacados).mockResolvedValue([producto("9", "OTRO PRODUCTO DEL DIA", 260)]);
});

afterEach(() => {
  act(() => raiz.unmount());
  contenedor.remove();
  vi.clearAllMocks();
});

async function mostrar(ruta: string) {
  await act(async () => {
    raiz.render(
      <MemoryRouter initialEntries={[ruta]}>
        <ContextoZona.Provider value={ZONA}>
          <ProveedorLista>
            <MismoProductoPage />
          </ProveedorLista>
        </ContextoZona.Provider>
      </MemoryRouter>,
    );
  });
  await act(async () => new Promise((r) => setTimeout(r, 400)));
  return (contenedor.textContent ?? "").replace(/[\u00a0\u202f]/g, " ");
}

describe("Buscar", () => {
  it("el titular de una búsqueda sale de sus resultados, no del producto del día", async () => {
    const texto = await mostrar("/mismo-producto?q=yerba%20playadito");
    expect(texto).toContain("94% más");
    expect(texto).not.toContain("260%");
  });

  it("con lista, no la repite: muestra un acceso a Mi compra", async () => {
    window.localStorage.setItem(
      "changuito.lista.v1",
      JSON.stringify(Array.from({ length: 12 }, (_, i) => ({ id_producto: `x${i}`, nombre: `Producto ${i}`, cantidad: 1 }))),
    );
    const texto = await mostrar("/mismo-producto?q=yerba%20playadito");
    expect(texto).toContain("Ver mi compra (12)");
    expect(texto).not.toContain("Producto 3");
    expect(contenedor.querySelector('a[href="/lista"]')).not.toBeNull();
  });
});
