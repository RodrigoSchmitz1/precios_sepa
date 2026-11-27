// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { obtenerPromosDeProductos } from "../api/client";
import type { Gasto, PromoCerca } from "../types";
import { alternarAviso } from "../utils/avisos";
import { guardarGastos, hoyEnArgentina } from "../utils/gastos";
import type { Zona } from "../utils/zona";
import BloqueAvisos from "./BloqueAvisos";

/* Lo que comprás seguido se vigila solo (openspec app-para-el-usuario). */

vi.mock("../api/client", () => ({ obtenerPromosDeProductos: vi.fn() }));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const PALERMO: Zona = { nombre: "Palermo", provincia: "AR-C", latitud: -34.58, longitud: -58.42, cadenas: ["Coto", "Dia"] };
const hoy = hoyEnArgentina();

const PROMO_YERBA: PromoCerca = {
  id_producto: "y", descripcion: "YERBA PLAYADITO", cadena: "Coto", nombre_sucursal: "Suc", calle: "Santa Fe", numero: "4000",
  barrio: null, localidad: "Palermo", provincia: "AR-C", latitud: 0, longitud: 0, distancia_km: 0.4, otras_sucursales_cerca: 1,
  precio_lista: 5200, precio_promo: 4160, descuento_pct: 20, leyenda: null, nivel_evidencia: "leyenda", vigente_hasta: "2026-11-30",
  requiere_compra_multiple: false,
};

const linea = (id: string, nombre: string) => ({
  descripcion: nombre, cantidad: 1, precio_unitario: 1000, importe: 1000, codigo: id, id_producto: id, nombre, categoria: "Almacén", vinculo: "codigo" as const,
});
const ticket = (id: string): Gasto => ({
  id, origen: "foto", cadena: "Coto", cadenas_sepa: ["Coto"], sucursal: null, fecha: hoy, comprobante: null, total: 3000,
  lineas: [linea("y", "Yerba Playadito"), linea("l", "Leche"), linea("c", "Café")], descuentos: [], creado: Number(id),
});

let contenedor: HTMLDivElement;
let raiz: Root;

beforeEach(() => {
  window.localStorage.clear();
  contenedor = document.createElement("div");
  document.body.appendChild(contenedor);
  raiz = createRoot(contenedor);
  vi.mocked(obtenerPromosDeProductos).mockResolvedValue({ y: [PROMO_YERBA] });
});

afterEach(() => {
  act(() => raiz.unmount());
  contenedor.remove();
  vi.clearAllMocks();
});

async function mostrar() {
  await act(async () => {
    raiz.render(
      <MemoryRouter>
        <BloqueAvisos zona={PALERMO} />
      </MemoryRouter>,
    );
  });
  return (contenedor.textContent ?? "").replace(/[\u00a0\u202f]/g, " ");
}

describe("productos vigilados", () => {
  it("la yerba que compra siempre aparece en sus avisos, marcada como algo que compra seguido", async () => {
    guardarGastos([ticket("1"), ticket("2")]);
    const t = await mostrar();
    expect(obtenerPromosDeProductos).toHaveBeenCalledWith(["y", "l", "c"], PALERMO);
    expect(t).toContain("1 de tus avisos está de oferta cerca");
    expect(t).toContain("lo comprás seguido");
  });

  it("silenciar un producto lo saca aunque siga en la compra habitual", async () => {
    guardarGastos([ticket("1"), ticket("2")]);
    await mostrar();
    const silenciar = contenedor.querySelector<HTMLButtonElement>('button[aria-label^="Silenciar"]')!;
    await act(async () => silenciar.click());
    expect(obtenerPromosDeProductos).toHaveBeenLastCalledWith(["l", "c"], PALERMO);
    await act(async () => raiz.unmount());
    raiz = createRoot(contenedor);
    await mostrar();
    expect(obtenerPromosDeProductos).toHaveBeenLastCalledWith(["l", "c"], PALERMO);
  });

  it("un producto pedido y comprado seguido aparece una sola vez", async () => {
    guardarGastos([ticket("1"), ticket("2")]);
    alternarAviso({ id_producto: "y", descripcion: "YERBA PLAYADITO" }, hoy);
    await mostrar();
    expect(obtenerPromosDeProductos).toHaveBeenCalledWith(["y", "l", "c"], PALERMO);
  });

  it("sin compra habitual solo están los avisos pedidos", async () => {
    alternarAviso({ id_producto: "y", descripcion: "YERBA PLAYADITO" }, hoy);
    const t = await mostrar();
    expect(obtenerPromosDeProductos).toHaveBeenCalledWith(["y"], PALERMO);
    expect(t).not.toContain("lo comprás seguido");
  });
});
