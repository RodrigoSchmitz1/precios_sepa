import { describe, expect, it } from "vitest";
import type { PrecioEnCadena } from "../types";
import { ejemploDePortada } from "./ejemploPortada";

const p = (cadena: string, precio_mediano: number, precio_creible = true): PrecioEnCadena => ({
  cadena,
  precio_mediano,
  precio_minimo: precio_mediano,
  precio_maximo: precio_mediano,
  sucursales: 10,
  precio_creible,
});

const COCA = [p("Maxi (Carrefour)", 5100), p("Día", 5500), p("Coto", 6100), p("Disco", 6200), p("La Anónima", 6450), p("Rara", 2000, false)];

describe("ejemploDePortada", () => {
  it("sin zona: las del país, la más barata, una del medio y la más cara", () => {
    const e = ejemploDePortada(COCA, null)!;
    expect(e.filas.map((f) => f.cadena)).toEqual(["Maxi (Carrefour)", "Coto", "La Anónima"]);
    expect(e.deZona).toBe(false);
    expect(Math.round(e.diferenciaPct)).toBe(26);
  });

  it("Palermo: solo las cadenas cerca, sin La Anónima", () => {
    const e = ejemploDePortada(COCA, new Set(["Día", "Coto", "Disco"]))!;
    expect(e.filas.map((f) => f.cadena)).toEqual(["Día", "Coto", "Disco"]);
    expect(e.deZona).toBe(true);
    expect(e.cadenas).toBe(3);
    expect(Math.round(e.diferenciaPct)).toBe(13);
  });

  it("Rafaela: una sola cadena cerca, vuelve al país", () => {
    const e = ejemploDePortada(COCA, new Set(["La Anónima"]))!;
    expect(e.deZona).toBe(false);
    expect(e.filas).toHaveLength(3);
  });

  it("un precio no creíble no entra", () => {
    expect(ejemploDePortada(COCA, null)!.filas.map((f) => f.cadena)).not.toContain("Rara");
  });
});
