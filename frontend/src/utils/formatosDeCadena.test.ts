import { describe, expect, it } from "vitest";
import type { PrecioEnCadena } from "../types";
import { FORMATO_DE, agruparFormatos, nombrarCadenas } from "./formatosDeCadena";

function precio(cadena: string, precio_mediano: number, extra: Partial<PrecioEnCadena> = {}): PrecioEnCadena {
  return {
    cadena,
    precio_mediano,
    precio_minimo: precio_mediano,
    precio_maximo: precio_mediano,
    sucursales: 10,
    precio_creible: true,
    fecha_precio: "2026-11-17",
    cambio: null,
    ...extra,
  };
}

describe("agruparFormatos", () => {
  it("dos formatos al mismo precio van en una fila; el que cobra distinto, aparte", () => {
    const filas = agruparFormatos([
      precio("SuperChangomás", 2600),
      precio("Changomás", 2700, { sucursales: 50, precio_minimo: 2650 }),
      precio("HiperChangomás", 2700, { sucursales: 30, precio_maximo: 2800 }),
    ]);
    expect(filas.map((f) => f.cadena)).toEqual(["SuperChangomás", "Changomás · HiperChangomás"]);
    expect(filas[1]).toMatchObject({ sucursales: 80, precio_minimo: 2650, precio_maximo: 2800 });
  });

  it("Maxi y Cencosud no se agrupan aunque coincidan", () => {
    const filas = agruparFormatos([precio("Carrefour", 1000), precio("Maxi (Carrefour)", 1000), precio("Disco", 900), precio("Jumbo", 900)]);
    expect(filas).toHaveLength(4);
  });

  it("creíble con no creíble, o precios de días distintos, no se agrupan", () => {
    expect(agruparFormatos([precio("Carrefour", 1000), precio("Market (Carrefour)", 1000, { precio_creible: false })])).toHaveLength(2);
    expect(agruparFormatos([precio("Carrefour", 1000), precio("Market (Carrefour)", 1000, { fecha_precio: "2026-11-16" })])).toHaveLength(2);
  });

  it("el cambio de precio queda solo si es el mismo en todas", () => {
    const baja = { precio_anterior: 1100, fecha: "2026-11-25", pct: -9.1 };
    expect(agruparFormatos([precio("Carrefour", 1000, { cambio: baja }), precio("Market (Carrefour)", 1000, { cambio: { ...baja } })])[0].cambio).toEqual(baja);
    expect(agruparFormatos([precio("Carrefour", 1000, { cambio: baja }), precio("Market (Carrefour)", 1000)])[0].cambio).toBeNull();
  });

  it("no toca el arreglo original", () => {
    const originales = [precio("Carrefour", 1000), precio("Market (Carrefour)", 1000)];
    agruparFormatos(originales);
    expect(originales.map((p) => p.cadena)).toEqual(["Carrefour", "Market (Carrefour)"]);
  });
});

describe("nombrarCadenas", () => {
  it("nombres completos hasta tres", () => {
    expect(nombrarCadenas(["Coto"])).toBe("Coto");
    expect(nombrarCadenas(["Coto", "Día"])).toBe("Coto y Día");
    expect(nombrarCadenas(["Coto", "Día", "Vea"])).toBe("Coto, Día y Vea");
    expect(nombrarCadenas(["Coto", "Día", "Vea", "Disco", "Jumbo"])).toBe("Coto, Día, Vea y 2 más");
  });

  it("los formatos de una cadena se nombran juntos", () => {
    expect(nombrarCadenas(["Changomás", "HiperChangomás"])).toBe("Changomás · HiperChangomás");
    expect(nombrarCadenas(["Coto", "Carrefour", "Market (Carrefour)"])).toBe("Coto y Carrefour · Market (Carrefour)");
  });

  it("los nombres de bandera que conoce son los de hoy", () => {
    expect(Object.keys(FORMATO_DE)).toEqual(expect.arrayContaining(["Market (Carrefour)", "Express (Carrefour)", "SuperChangomás", "HiperChangomás"]));
    expect(FORMATO_DE["Maxi (Carrefour)"]).toBeUndefined();
  });
});
