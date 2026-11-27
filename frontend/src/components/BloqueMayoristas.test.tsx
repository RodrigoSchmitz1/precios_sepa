// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import BloqueMayoristas from "./BloqueMayoristas";
import { diferenciaContraSuper, etiquetaMayorista, textoBulto, tituloFilaCadena } from "../utils/mayoristas";
import type { PrecioMayorista } from "../types";

/* Los mayoristas en el detalle de un producto (openspec sumar-mayoristas). */

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mayorista = (cadena: string, precio: number, unidades: number | null, creible = true): PrecioMayorista => ({
  cadena,
  precio_mediano: precio,
  precio_minimo: precio,
  precio_maximo: precio,
  sucursales: 10,
  precio_creible: creible,
  fecha_precio: "2026-11-25",
  unidades_bulto: unidades,
  precio_bulto: unidades ? precio * unidades : null,
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

const pintar = (elemento: React.ReactElement) => act(() => raiz.render(elemento));
const texto = () => contenedor.textContent?.replace(/\s+/g, " ") ?? "";

describe("BloqueMayoristas", () => {
  it("muestra el precio por unidad, el bulto y la diferencia contra el súper más barato", () => {
    pintar(<BloqueMayoristas mayoristas={[mayorista("Maxiconsumo", 1700, 12)]} precioSuper={2000} />);
    expect(texto()).toContain("En mayoristas, comprando el bulto");
    expect(texto()).toMatch(/Maxiconsumo · mayorista/);
    expect(texto()).toMatch(/comprando el bulto de 12 \(\$\s?20\.400\)/);
    expect(texto()).toContain("15% menos por unidad que el súper más barato");
    expect(texto()).toMatch(/\$\s?1\.700 c\/u/);
  });

  it("sin mayoristas, o solo con precios no creíbles, no muestra nada", () => {
    pintar(<BloqueMayoristas mayoristas={[]} precioSuper={2000} />);
    expect(contenedor.innerHTML).toBe("");
    pintar(<BloqueMayoristas mayoristas={[mayorista("Basualdo", 13, 1, false)]} precioSuper={2000} />);
    expect(contenedor.innerHTML).toBe("");
    pintar(<BloqueMayoristas mayoristas={undefined} precioSuper={2000} />);
    expect(contenedor.innerHTML).toBe("");
  });

  it("con zona, los mayoristas cerca van primero y se comparan con el súper de la zona", () => {
    pintar(
      <BloqueMayoristas
        mayoristas={[mayorista("Maxiconsumo", 1700, 12), mayorista("Makro", 1900, 1)]}
        precioSuper={2000}
        deZona
        cercanos={["Makro"]}
      />,
    );
    const filas = Array.from(contenedor.querySelectorAll("li")).map((li) => li.textContent ?? "");
    expect(filas[0]).toContain("Makro · mayorista cerca");
    expect(filas[0]).not.toContain("mayorista · mayorista");
    expect(filas[0]).toContain("por unidad");
    expect(filas[1]).toContain("Maxiconsumo · mayorista");
    expect(texto()).toContain("el súper más barato de tu zona");
  });
});

describe("textos", () => {
  it("diferencia contra el súper", () => {
    expect(diferenciaContraSuper(1700, 2000)).toBe("15% menos por unidad que");
    expect(diferenciaContraSuper(2080, 2000)).toBe("4% más por unidad que");
    expect(diferenciaContraSuper(2004, 2000)).toBe("lo mismo por unidad que");
  });

  it("etiqueta de mayorista", () => {
    expect(etiquetaMayorista({ mayorista: true, unidades_bulto: 6 })).toBe("mayorista · bulto de 6");
    expect(etiquetaMayorista({ mayorista: true, unidades_bulto: 1 })).toBe("mayorista");
    expect(etiquetaMayorista({})).toBeNull();
  });

  it("titulo de la fila de la vidriera", () => {
    expect(tituloFilaCadena({ cadena: "Día" })).toBe("Lo mejor de Día hoy");
    expect(tituloFilaCadena({ cadena: "Yaguar", mayorista: true })).toBe("Mayorista Yaguar hoy");
    expect(tituloFilaCadena({ cadena: "La Agrícola Regional (mayorista)", mayorista: true })).toBe("La Agrícola Regional (mayorista) hoy");
  });

  it("bulto", () => {
    expect(textoBulto({ unidades_bulto: 1, precio_bulto: 100 })).toBe("por unidad");
    expect(textoBulto({ unidades_bulto: null, precio_bulto: null })).toBe("por unidad");
    expect(textoBulto({ unidades_bulto: 6, precio_bulto: 6000 })).toMatch(/^comprando el bulto de 6 \(\$\s?6\.000\)$/);
  });
});
