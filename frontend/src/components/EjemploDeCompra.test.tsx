// @vitest-environment jsdom
import { act, useEffect } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { obtenerBasicos } from "../api/client";
import { useLista } from "../contexto/lista";
import type { Basico, ProductoComparado } from "../types";
import EjemploDeCompra from "./EjemploDeCompra";
import ProveedorLista from "./ProveedorLista";

/* La compra de ejemplo de la primera visita (openspec ejemplo-para-empezar). */

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

async function mostrar(conEjemplo = true) {
  await act(async () => {
    raiz.render(
      <ProveedorLista conEjemplo={conEjemplo}>
        <Espia onEstado={(e) => {
          estado = e;
        }} />
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
  it("la primera vez carga los dos básicos con más empresas de cada grupo, con el cartel", async () => {
    await mostrar();
    expect(estado.esEjemplo).toBe(true);
    expect(estado.lista).toHaveLength(12);
    expect(estado.lista.map((i) => i.id_producto).filter((id) => id.endsWith("1"))).toEqual([]);
    expect(contenedor.textContent).toContain("Lista de ejemplo");
    expect(boton("Limpieza")).toBeTruthy();
  });

  it("sin conEjemplo (fuera del Layout) no carga nada", async () => {
    await mostrar(false);
    expect(estado.lista).toEqual([]);
    expect(obtenerBasicos).not.toHaveBeenCalled();
  });

  it("borrar el ejemplo vacía la lista y no vuelve", async () => {
    await mostrar();
    await act(async () => boton("Borrar el ejemplo")!.click());
    expect(estado.lista).toEqual([]);
    await remontar();
    expect(estado.lista).toEqual([]);
    expect(contenedor.textContent).not.toContain("Lista de ejemplo");
  });

  it("sacar un grupo no la hace propia", async () => {
    await mostrar();
    await act(async () => boton("Limpieza")!.click());
    expect(estado.lista.some((i) => i.grupo === "Limpieza")).toBe(false);
    expect(estado.lista).toHaveLength(10);
    expect(estado.esEjemplo).toBe(true);
  });

  it("sumar un producto la hace propia y conserva lo que había", async () => {
    await mostrar();
    await act(async () => estado.agregar({ id_producto: "999", nombre: "Atún", cantidad: 1 }));
    expect(estado.esEjemplo).toBe(false);
    expect(estado.lista).toHaveLength(13);
    expect(contenedor.textContent).not.toContain("Lista de ejemplo");
    await act(async () => estado.vaciar());
    await remontar();
    expect(estado.lista).toEqual([]);
  });

  it("con una lista propia guardada no carga el ejemplo, ni después de vaciarla", async () => {
    window.localStorage.setItem("changuito.lista.v1", JSON.stringify([{ id_producto: "1", nombre: "Yerba", cantidad: 1 }]));
    await mostrar();
    expect(estado.lista).toHaveLength(1);
    expect(estado.esEjemplo).toBe(false);
    await act(async () => estado.vaciar());
    await remontar();
    expect(estado.lista).toEqual([]);
  });

  it("una lista que llega por link tiene prioridad", async () => {
    window.history.replaceState(null, "", "/lista?l=7790001");
    await mostrar();
    expect(estado.lista).toEqual([]);
    expect(obtenerBasicos).not.toHaveBeenCalled();
  });

  it("si faltan básicos no hay ejemplo y se reintenta en la próxima visita", async () => {
    vi.mocked(obtenerBasicos).mockResolvedValueOnce(BASICOS.slice(0, 6));
    await mostrar();
    expect(estado.lista).toEqual([]);
    await remontar();
    expect(estado.lista).toHaveLength(12);
  });
});
