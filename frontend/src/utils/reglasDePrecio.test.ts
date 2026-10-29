import { describe, expect, it } from "vitest";
import type { ReglaDePrecio } from "../types";
import { conectorEscalones, escalonesVisibles } from "./reglasDePrecio";

function regla(pct_mas_barata: number, escalones: [number, number][]): ReglaDePrecio {
  return {
    cadena: "Maxi (Carrefour)",
    referencia: "Carrefour",
    productos: 14632,
    pct_igual: 38,
    pct_mas_barata,
    pct_mas_cara: 4.3,
    escalones: escalones.map(([descuento_pct, pct_productos]) => ({ descuento_pct, pct_productos })),
  } as ReglaDePrecio;
}

describe("conectorEscalones", () => {
  it("dice 'sobre todo' si los escalones cubren poco de lo que es mas barata (Maxi, 28-10)", () => {
    expect(conectorEscalones(regla(58, [[5, 21], [10, 11], [15, 2]]))).toBe("sobre todo");
  });

  it("dice 'casi siempre' si cubren al menos el 80% (SuperChangomas, 28-10)", () => {
    expect(conectorEscalones(regla(63, [[5, 31], [4, 29]]))).toBe("casi siempre");
  });

  it("no nombra escalones de menos del 1% ni dice nada sin escalones", () => {
    const r = regla(10, [[3, 0.5]]);
    expect(escalonesVisibles(r)).toEqual([]);
    expect(conectorEscalones(r)).toBeNull();
  });
});
