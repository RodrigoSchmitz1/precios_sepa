// @vitest-environment jsdom
import { act, useEffect } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useLista } from "../contexto/lista";
import type { Gasto } from "../types";
import { guardarGastos, hoyEnArgentina } from "../utils/gastos";
import ArmarConLoQueCompras from "./ArmarConLoQueCompras";
import ProveedorLista from "./ProveedorLista";

/* Armar Mi compra con lo que comprás (openspec app-para-el-usuario). */

vi.mock("../api/client", () => ({ obtenerBasicos: vi.fn() }));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const hoy = hoyEnArgentina();
const linea = (id: string, nombre: string, cantidad: number) => ({
  descripcion: nombre, cantidad, precio_unitario: 1000, importe: 1000 * cantidad, codigo: id,
  id_producto: id, nombre, categoria: "Almacén", vinculo: "codigo" as const,
});
const ticket = (id: string, lineas: ReturnType<typeof linea>[]): Gasto => ({
  id, origen: "foto", cadena: "Coto", cadenas_sepa: ["Coto"], sucursal: null, fecha: hoy, comprobante: null,
  total: lineas.reduce((s, l) => s + l.importe, 0), lineas, descuentos: [], creado: Number(id),
});

let contenedor: HTMLDivElement;
let raiz: Root;
let estado: ReturnType<typeof useLista>;
function Espia() {
  const e = useLista();
  useEffect(() => {
    estado = e;
  });
  return null;
}

beforeEach(() => {
  window.localStorage.clear();
  contenedor = document.createElement("div");
  document.body.appendChild(contenedor);
  raiz = createRoot(contenedor);
});

afterEach(() => {
  act(() => raiz.unmount());
  contenedor.remove();
});

async function mostrar() {
  await act(async () => {
    raiz.render(
      <ProveedorLista>
        <Espia />
        <ArmarConLoQueCompras />
      </ProveedorLista>,
    );
  });
}

describe("ArmarConLoQueCompras", () => {
  it("con compra habitual suma sus productos con la cantidad típica", async () => {
    const repetidos = () => [linea("1", "Yerba", 1), linea("2", "Leche", 3), linea("3", "Café", 1)];
    guardarGastos([ticket("1", repetidos()), ticket("2", repetidos()), ticket("3", [linea("4", "Aceite", 1)])]);
    await mostrar();
    const boton = [...contenedor.querySelectorAll("button")].find((b) => b.textContent?.includes("Armarla con lo que comprás"))!;
    await act(async () => boton.click());
    expect(new Map(estado.lista.map((i) => [i.id_producto, i.cantidad]))).toEqual(new Map([["1", 1], ["2", 3], ["3", 1]]));
    expect(contenedor.textContent).toContain("Sumamos 3 productos");
  });

  it("sin compra habitual no aparece", async () => {
    guardarGastos([ticket("1", [linea("1", "Yerba", 1)])]);
    await mostrar();
    expect(contenedor.textContent).toBe("");
  });
});
