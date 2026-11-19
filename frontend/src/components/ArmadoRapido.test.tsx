// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { obtenerBasicos } from "../api/client";
import { useLista } from "../contexto/lista";
import type { Basico, ProductoComparado } from "../types";
import ArmadoRapido from "./ArmadoRapido";
import ProveedorLista from "./ProveedorLista";

/* El armado rapido de Tu lista (openspec lista-en-el-centro). */

vi.mock("../api/client", () => ({ obtenerBasicos: vi.fn() }));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const producto = (id_producto: string, descripcion: string): ProductoComparado =>
  ({ id_producto, descripcion, marca: null, categoria: "Yerba mate", cantidad_normalizada: null, unidad_normalizada: null }) as unknown as ProductoComparado;

const BASICOS: Basico[] = [
  { grupo: "Almacén", nombre: "Yerba", producto: producto("1", "PLAYADITO YERBA MATE SUAVE 1KG") },
  { grupo: "Almacén", nombre: "Aceite", producto: producto("2", "NATURA ACEITE DE GIRASOL 1.5L") },
  { grupo: "Lácteos", nombre: "Leche", producto: producto("3", "LA SERENISIMA LECHE ENTERA 1L") },
];

let contenedor: HTMLDivElement;
let raiz: Root;
/** Lo que hay en la lista, pintado para poder leerlo. */
function Espia() {
  return <output data-ids={useLista().lista.map((i) => i.id_producto).join(",")} />;
}
const ids = () => contenedor.querySelector("output")!.getAttribute("data-ids");

beforeEach(() => {
  window.localStorage.clear();
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
        <ArmadoRapido />
        <Espia />
      </ProveedorLista>,
    );
  });
}

const boton = (nombre: string) => [...contenedor.querySelectorAll("button")].find((b) => b.textContent?.includes(nombre))!;

describe("ArmadoRapido", () => {
  it("muestra los básicos agrupados", async () => {
    await mostrar();
    expect([...contenedor.querySelectorAll("h3")].map((h) => h.textContent)).toEqual(["Almacén", "Lácteos"]);
    expect(boton("Yerba").getAttribute("aria-pressed")).toBe("false");
  });

  it("un toque suma a la lista y otro la saca", async () => {
    await mostrar();
    await act(async () => boton("Yerba").click());
    expect(ids()).toBe("1");
    expect(boton("Yerba").getAttribute("aria-pressed")).toBe("true");
    await act(async () => boton("Yerba").click());
    expect(ids()).toBe("");
  });

  it("si la API falla, no muestra nada", async () => {
    vi.mocked(obtenerBasicos).mockRejectedValue(new Error("caída"));
    await mostrar();
    expect(contenedor.querySelectorAll("button")).toHaveLength(0);
  });
});
