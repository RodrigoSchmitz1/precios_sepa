// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import MayoristasDeTuLista from "./MayoristasDeTuLista";
import { avisoPromoEnTitular } from "../utils/promosCerca";
import type { PromoCerca } from "../types";

/* Tu lista en los mayoristas cerca, y el titular sin sus promos (openspec sumar-mayoristas). */

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

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

describe("MayoristasDeTuLista", () => {
  it("dice cuántos productos tiene cada mayorista y cuánto suman por unidad", () => {
    act(() =>
      raiz.render(<MayoristasDeTuLista filas={[{ cadena: "Maxiconsumo", productos_con_precio: 7, productos: 10, total: 18500 }]} />),
    );
    const texto = contenedor.textContent?.replace(/\s+/g, " ") ?? "";
    expect(texto).toContain("En mayoristas cerca");
    expect(texto).toContain("No entra en la comparación de arriba");
    expect(texto).toMatch(/Maxiconsumo\s?\$\s?18\.500 por 7 de 10/);
  });

  it("sin mayoristas no muestra nada", () => {
    act(() => raiz.render(<MayoristasDeTuLista filas={[]} />));
    expect(contenedor.innerHTML).toBe("");
  });
});

describe("avisoPromoEnTitular", () => {
  const promo = (cadena: string, precio: number, mayorista = false): PromoCerca =>
    ({
      cadena,
      nombre_sucursal: "s",
      calle: "Av. Siempreviva",
      numero: "742",
      barrio: null,
      localidad: "Palermo",
      provincia: "AR-C",
      latitud: -34.58,
      longitud: -58.42,
      id_producto: "1",
      descripcion: "YERBA",
      distancia_km: 1,
      otras_sucursales_cerca: 0,
      precio_lista: 3000,
      precio_promo: precio,
      descuento_pct: 30,
      leyenda: null,
      nivel_evidencia: "leyenda",
      vigente_hasta: null,
      requiere_compra_multiple: false,
      ...(mayorista ? { mayorista: true, unidades_bulto: 12 } : {}),
    }) as PromoCerca;

  it("una promo de mayorista no gana el titular del producto", () => {
    expect(avisoPromoEnTitular([promo("Yaguar", 1500, true)], 2500)).toBe("");
    expect(avisoPromoEnTitular([promo("Yaguar", 1500, true), promo("Dia", 2000)], 2500)).toContain("Dia");
  });
});
