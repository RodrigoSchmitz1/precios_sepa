// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { FilasDePrecios } from "../pages/MismoProductoPage";
import type { PrecioEnCadena } from "../types";

/* Las filas del detalle con los formatos de una cadena (openspec formatos-de-una-cadena). */

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const precio = (cadena: string, precio_mediano: number, sucursales: number): PrecioEnCadena => ({
  cadena,
  precio_mediano,
  precio_minimo: precio_mediano,
  precio_maximo: precio_mediano,
  sucursales,
  precio_creible: true,
  fecha_precio: "2026-11-17",
  cambio: null,
});

let contenedor: HTMLDivElement;
let raiz: Root;

beforeEach(() => {
  contenedor = document.createElement("div");
  document.body.appendChild(contenedor);
  raiz = createRoot(contenedor);
});

afterEach(() => {
  act(() => raiz.unmount());
  contenedor.remove();
});

describe("FilasDePrecios con formatos", () => {
  it("una fila para los formatos al mismo precio, con las sucursales sumadas", async () => {
    await act(async () => {
      raiz.render(
        <FilasDePrecios
          fechaDatos="2026-11-17"
          precios={[precio("SuperChangomás", 2600, 9), precio("Changomás", 2700, 53), precio("HiperChangomás", 2700, 31), precio("Maxi (Carrefour)", 2700, 34)]}
        />,
      );
    });
    const filas = [...contenedor.querySelectorAll("li")].map((li) => (li.textContent ?? "").replace(/[\u00a0\u202f]/g, " "));
    expect(filas).toHaveLength(3);
    expect(filas[0]).toContain("SuperChangomás");
    expect(filas[1]).toContain("Changomás · HiperChangomás");
    expect(filas[1]).toContain("84 sucursales");
    expect(filas[2]).toContain("Maxi (Carrefour)");
  });

  it("la farmacia se dice como farmacia (openspec comercios-regionales-y-farmacity)", async () => {
    await act(async () => {
      raiz.render(<FilasDePrecios fechaDatos="2026-11-17" precios={[{ ...precio("Farmacity", 4500, 300), farmacia: true }, precio("Coto", 5000, 40)]} />);
    });
    const filas = [...contenedor.querySelectorAll("li")].map((li) => li.textContent ?? "");
    expect(filas[0]).toContain("Farmacity · farmacia");
    expect(filas[1]).not.toContain("farmacia");
  });
});
