import { describe, expect, it } from "vitest";
import { claseCambio, textoCambioDetalle, textoCambioLista } from "./cambioPrecio";

const normal = (t: string) => t.replace(/[\u00a0\u202f]/g, " ");
const baja = { precio_anterior: 4000, fecha: "2026-11-25", pct: -10 };
const suba = { precio_anterior: 2400, fecha: "2026-12-01", pct: 8.3 };

describe("textoCambioDetalle", () => {
  it("una baja con el precio anterior", () => {
    expect(normal(textoCambioDetalle(baja))).toBe("Bajó 10% el 25/11 (antes $ 4.000)");
  });

  it("una suba redondeada a entero", () => {
    expect(normal(textoCambioDetalle(suba))).toBe("Subió 8% el 1/12 (antes $ 2.400)");
    expect(normal(textoCambioDetalle({ ...suba, pct: 3.6 }))).toMatch(/^Subió 4%/);
  });

  it("sin cambio, nada", () => {
    expect(textoCambioDetalle(null)).toBe("");
    expect(textoCambioDetalle(undefined)).toBe("");
  });
});

describe("textoCambioLista", () => {
  it("dice en qué cadena", () => {
    expect(textoCambioLista({ ...baja, pct: -6.2 }, "Día")).toBe("Bajó 6% en Día el 25/11");
    expect(textoCambioLista(suba, "Coto")).toBe("Subió 8% en Coto el 1/12");
  });

  it("sin cambio, nada", () => {
    expect(textoCambioLista(null, "Día")).toBe("");
  });
});

describe("claseCambio", () => {
  it("verde la baja, aviso la suba", () => {
    expect(claseCambio(baja)).toBe("text-ahorro");
    expect(claseCambio(suba)).toBe("text-aviso");
  });
});
