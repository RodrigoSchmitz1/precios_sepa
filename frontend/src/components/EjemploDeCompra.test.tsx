// @vitest-environment jsdom
import { act, useEffect } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { obtenerBasicos } from "../api/client";
import { useLista } from "../contexto/lista";
import type { Basico, ProductoComparado } from "../types";
import EjemploDeCompra, { BotonVerEjemplo } from "./EjemploDeCompra";
import ProveedorLista from "./ProveedorLista";

/* La compra de ejemplo a pedido (openspec app-para-el-usuario, antes ejemplo-para-empezar). */

vi.mock("../api/client", () => ({ obtenerBasicos: vi.fn() }));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const GRUPOS = ["Almacén", "Desayuno", "Lácteos", "Bebidas", "Limpieza", "Higiene"];
// Tres por grupo: el de menos empresas queda afuera del ejemplo.
const BASICOS: Basico[] = GRUPOS.flatMap((grupo, g) =>
  [9, 4, 7].map((empresas, k) => ({
    grupo,
    nombre: `${grupo} ${k}`,
    producto: { id_producto: String(100 + g * 10 + k), descripcion: `${grupo} ${k}`.toUpperCase(), marca: null, categoria: null, empresas } as unknown as ProductoComparado,
  })),
);

let contenedor: HTMLDivElement;
let raiz: Root;
let estado: ReturnType<typeof useLista>;
function Espia({ onEstado }: { onEstado: (e: ReturnType<typeof useLista>) => void }) {
  const e = useLista();
  useEffect(() => {
    onEstado(e);
  });
  return null;
}

beforeEach(() => {
  window.localStorage.clear();
  window.history.replaceState(null, "", "/");
  contenedor = document.createElement("div");
  document.body.appendChild(contenedor);
  raiz = createRoot(contenedor);
  vi.mocked(obtenerBasicos).mockResolvedValue(BASICOS);
});

afterEach(() => {
  act(() => raiz.unmount());
  contenedor.remove();
  vi.clearAllMocks();
});

async function mostrar() {
  await act(async () => {
    raiz.render(
      <ProveedorLista>
        <Espia onEstado={(e) => {
          estado = e;
        }} />
        <BotonVerEjemplo />
        <EjemploDeCompra />
      </ProveedorLista>,
    );
  });
}

async function remontar() {
  act(() => raiz.unmount());
  raiz = createRoot(contenedor);
  await mostrar();
}

const boton = (texto: string) => [...contenedor.querySelectorAll("button")].find((b) => b.textContent?.includes(texto));

describe("compra de ejemplo", () => {
  it("no se carga sola: la lista arranca vacía y sin pedir básicos", async () => {
    await mostrar();
    expect(estado.lista).toEqual([]);
    expect(estado.esEjemplo).toBe(false);
    expect(obtenerBasicos).not.toHaveBeenCalled();
    expect(boton("Ver un ejemplo")).toBeTruthy();
  });

  it("Ver un ejemplo carga los dos básicos con más empresas de cada grupo, con el cartel", async () => {
    await mostrar();
    await act(async () => boton("Ver un ejemplo")!.click());
    expect(estado.esEjemplo).toBe(true);
    expect(estado.lista).toHaveLength(12);
    expect(estado.lista.map((i) => i.id_producto).filter((id) => id.endsWith("1"))).toEqual([]);
    expect(contenedor.textContent).toContain("Lista de ejemplo");
    expect(boton("Limpieza")).toBeTruthy();
  });

  it("borrar el ejemplo vacía la lista y no vuelve cargado", async () => {
    await mostrar();
    await act(async () => boton("Ver un ejemplo")!.click());
    await act(async () => boton("Borrar el ejemplo")!.click());
    expect(estado.lista).toEqual([]);
    await remontar();
    expect(estado.lista).toEqual([]);
    expect(contenedor.textContent).not.toContain("Lista de ejemplo");
    expect(boton("Ver un ejemplo")).toBeTruthy();
  });

  it("sacar un grupo no la hace propia", async () => {
    await mostrar();
    await act(async () => boton("Ver un ejemplo")!.click());
    await act(async () => boton("Limpieza")!.click());
    expect(estado.lista.some((i) => i.grupo === "Limpieza")).toBe(false);
    expect(estado.lista).toHaveLength(10);
    expect(estado.esEjemplo).toBe(true);
  });

  it("sumar un producto reemplaza al ejemplo", async () => {
    await mostrar();
    await act(async () => boton("Ver un ejemplo")!.click());
    await act(async () => estado.agregar({ id_producto: "999", nombre: "Yerba", cantidad: 1 }));
    expect(estado.esEjemplo).toBe(false);
    expect(estado.lista.map((i) => i.id_producto)).toEqual(["999"]);
    expect(contenedor.textContent).not.toContain("Lista de ejemplo");
    expect(estado.deshacer).not.toBeNull();
  });

  it("Deshacer vuelve el ejemplo con lo sumado, como lista propia", async () => {
    await mostrar();
    await act(async () => boton("Ver un ejemplo")!.click());
    await act(async () => estado.agregar({ id_producto: "999", nombre: "Yerba", cantidad: 1 }));
    await act(async () => estado.deshacer!());
    expect(estado.lista).toHaveLength(13);
    expect(estado.esEjemplo).toBe(false);
    expect(estado.deshacer).toBeNull();
  });

  it("Deshacer se va solo después de unos segundos", async () => {
    vi.useFakeTimers();
    try {
      await mostrar();
      await act(async () => boton("Ver un ejemplo")!.click());
      await act(async () => estado.agregar({ id_producto: "999", nombre: "Yerba", cantidad: 1 }));
      await act(async () => vi.advanceTimersByTime(6100));
      expect(estado.deshacer).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it("cambiar una cantidad la hace propia y conserva los 12", async () => {
    await mostrar();
    await act(async () => boton("Ver un ejemplo")!.click());
    const id = estado.lista[0].id_producto;
    await act(async () => estado.cambiarCantidad(id, 3));
    expect(estado.esEjemplo).toBe(false);
    expect(estado.lista).toHaveLength(12);
  });

  it("con una lista propia, sumar no reemplaza nada", async () => {
    window.localStorage.setItem("changuito.lista.v1", JSON.stringify([{ id_producto: "1", nombre: "Yerba", cantidad: 1 }]));
    await mostrar();
    await act(async () => estado.agregar({ id_producto: "2", nombre: "Leche", cantidad: 1 }));
    expect(estado.lista).toHaveLength(2);
    expect(estado.deshacer).toBeNull();
  });

  it("si faltan básicos lo dice y la lista queda vacía", async () => {
    vi.mocked(obtenerBasicos).mockResolvedValueOnce(BASICOS.slice(0, 6));
    await mostrar();
    await act(async () => boton("Ver un ejemplo")!.click());
    expect(estado.lista).toEqual([]);
    expect(contenedor.textContent).toContain("No se pudo armar el ejemplo");
  });
});
