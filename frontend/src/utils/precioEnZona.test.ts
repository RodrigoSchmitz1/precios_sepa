import { describe, expect, it } from "vitest";
import type { PrecioEnCadena } from "../types";
import { partirPorZona, resumirZona } from "./precioEnZona";

function precio(cadena: string, precio_mediano: number, precio_creible = true): PrecioEnCadena {
  return { cadena, precio_mediano, precio_minimo: precio_mediano, precio_maximo: precio_mediano, sucursales: 10, precio_creible } as PrecioEnCadena;
}

// Ordenados por precio, como los manda la API.
const PRECIOS = [precio("Maxi (Carrefour)", 4500), precio("Día", 4775), precio("Coto", 5200), precio("Express (Carrefour)", 6000)];
const PALERMO = new Set(["Día", "Coto", "Express (Carrefour)"]);

describe("partirPorZona", () => {
  it("separa las cadenas de la zona y conserva el orden por precio", () => {
    const { enZona, resto } = partirPorZona(PRECIOS, PALERMO);
    expect(enZona.map((p) => p.cadena)).toEqual(["Día", "Coto", "Express (Carrefour)"]);
    expect(resto.map((p) => p.cadena)).toEqual(["Maxi (Carrefour)"]);
  });
});

describe("resumirZona", () => {
  it("la mas barata de la zona contra la mas cara de la zona", () => {
    const r = resumirZona(partirPorZona(PRECIOS, PALERMO).enZona);
    expect(r).toEqual({ tipo: "varias", baratas: ["Día"], precio: 4775, caras: ["Express (Carrefour)"], precioCaro: 6000, ahorroPct: 20 });
  });

  it("con una sola cadena en la zona no hay contra que comparar", () => {
    expect(resumirZona([precio("Día", 4775)])).toEqual({ tipo: "una", cadena: "Día", precio: 4775 });
  });

  it("ninguna cadena de la zona lo vende", () => {
    expect(resumirZona(partirPorZona(PRECIOS, new Set(["La Anónima"])).enZona)).toEqual({ tipo: "ninguna" });
  });

  it("un precio no creible no gana ni pierde", () => {
    const r = resumirZona([precio("Día", 1000, false), precio("Coto", 5200), precio("Express (Carrefour)", 6000)]);
    expect(r).toMatchObject({ baratas: ["Coto"], ahorroPct: 13 });
  });

  it("el mismo precio en todas las de la zona: ahorro cero", () => {
    expect(resumirZona([precio("Día", 5000), precio("Coto", 5000)])).toMatchObject({ tipo: "varias", ahorroPct: 0 });
  });
});
