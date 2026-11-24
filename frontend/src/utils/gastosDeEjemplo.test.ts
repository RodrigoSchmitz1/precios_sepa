// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import type { Basico, ProductoComparado } from "../types";
import { descartarEjemplo, ejemploDescartado, gastosDeEjemplo, PREFIJO_EJEMPLO } from "./gastosDeEjemplo";

/* El mes de ejemplo de Mis gastos (openspec ejemplo-para-empezar). */

const basico = (n: number): Basico => ({
  grupo: "Almacén",
  nombre: `B${n}`,
  producto: {
    id_producto: String(1000 + n), descripcion: `PRODUCTO ${n}`, marca: null, categoria: n % 2 ? "Almacen" : "Lacteos",
    precio_mas_bajo: 1000, precio_mas_alto: 2000,
  } as unknown as ProductoComparado,
});
const BASICOS = Array.from({ length: 20 }, (_, i) => basico(i + 1));

beforeEach(() => window.localStorage.clear());

describe("gastosDeEjemplo", () => {
  it("siete tickets del mes en las cadenas de la zona, con dos promos", () => {
    const gastos = gastosDeEjemplo(BASICOS, ["Coto", "Dia", "Vea", "Jumbo"], "2026-11-24");
    expect(gastos).toHaveLength(7);
    expect(gastos.every((g) => g.id.startsWith(PREFIJO_EJEMPLO) && g.origen === "foto")).toBe(true);
    expect(new Set(gastos.map((g) => g.cadena))).toEqual(new Set(["Coto", "Dia", "Vea"]));
    expect(gastos.every((g) => g.fecha.startsWith("2026-11-"))).toBe(true);
    expect(gastos.filter((g) => g.descuentos.length > 0)).toHaveLength(2);
    for (const g of gastos) {
      const bruto = g.lineas.reduce((s, l) => s + l.importe, 0);
      const descuentos = g.descuentos.reduce((s, d) => s + d.importe, 0);
      expect(g.total).toBeCloseTo(bruto - descuentos, 2);
      expect(g.lineas.every((l) => l.id_producto && l.precio_unitario >= 1000 && l.precio_unitario <= 2000)).toBe(true);
    }
  });

  it("a principio de mes no se sale del mes", () => {
    const gastos = gastosDeEjemplo(BASICOS, [], "2026-12-02");
    expect(gastos.every((g) => g.fecha >= "2026-12-01" && g.fecha <= "2026-12-02")).toBe(true);
    expect(gastos[0].cadena).toBe("Carrefour");
  });

  it("sin básicos con precio no arma nada, y no escribe en el teléfono", () => {
    expect(gastosDeEjemplo(BASICOS.slice(0, 3), ["Coto"], "2026-11-24")).toEqual([]);
    gastosDeEjemplo(BASICOS, ["Coto"], "2026-11-24");
    expect(window.localStorage.length).toBe(0);
  });

  it("descartar se recuerda", () => {
    expect(ejemploDescartado()).toBe(false);
    descartarEjemplo();
    expect(ejemploDescartado()).toBe(true);
  });
});
