/*
  La tarjeta de la portada no puede llamar "la canasta basica" a un total que
  deja categorias afuera (auditoria 2026-10-28: eran 25 de 32).
*/
import { describe, expect, it } from "vitest";
import type { CanastaPorCadena } from "../types";
import { ahorroEnCadenas } from "./ahorroCanasta";

function canasta(comparadas: number, total: number, totales: [string, number][]): CanastaPorCadena {
  return {
    ambito: "pais",
    cadenas: totales.map(([cadena, t]) => ({ cadena, total: t, con_otra_gama: 0, sucursales: 1 })),
    categorias_comparadas: Array.from({ length: comparadas }, (_, i) => `c${i}`),
    categorias_afuera: Array.from({ length: total - comparadas }, (_, i) => `f${i}`),
    cadenas_afuera: [],
    total_categorias: total,
    fecha_datos: "2026-10-27",
  };
}

describe("ahorroEnCadenas", () => {
  it("dice cuantas categorias entran cuando falta alguna", () => {
    const r = ahorroEnCadenas(canasta(25, 32, [["Maxi", 157348], ["Disco", 182521]]));
    expect(r?.pct).toBe(14);
    expect(r?.detalle).toMatch(/^25 de las 32 categorías de la canasta básica: /);
    expect(r?.detalle).toContain("en Maxi");
    expect(r?.detalle).toContain("en Disco");
  });

  it("dice la canasta basica solo cuando estan todas", () => {
    const r = ahorroEnCadenas(canasta(32, 32, [["Maxi", 100], ["Disco", 120]]));
    expect(r?.detalle).toMatch(/^la canasta básica: /);
  });

  it("no muestra nada sin dos cadenas o sin ahorro", () => {
    expect(ahorroEnCadenas(undefined)).toBeNull();
    expect(ahorroEnCadenas(canasta(32, 32, [["Maxi", 100]]))).toBeNull();
    expect(ahorroEnCadenas(canasta(32, 32, [["Maxi", 100], ["Dia", 100.2]]))).toBeNull();
  });
});
