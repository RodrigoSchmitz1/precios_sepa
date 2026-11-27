import { describe, expect, it } from "vitest";
import type { Gasto, InflacionResumen } from "../types";
import { gondolaPonderada, tuInflacion } from "./tuInflacion";

/* Tu inflación (openspec app-para-el-usuario). */

const linea = (id: string, nombre: string, categoria: string, cantidad: number, importe: number) => ({
  descripcion: nombre, cantidad, precio_unitario: importe / cantidad, importe, codigo: id, id_producto: id, nombre,
  categoria, vinculo: "codigo" as const,
});
const ticket = (id: string, fecha: string, lineas: ReturnType<typeof linea>[]): Gasto => ({
  id, origen: "foto", cadena: "Coto", cadenas_sepa: ["Coto"], sucursal: null, fecha, comprobante: null,
  total: lineas.reduce((s, l) => s + l.importe, 0), lineas, descuentos: [], creado: Number(id),
});

const OCTUBRE = ticket("1", "2026-10-10", [
  linea("y", "Yerba", "Yerba mate", 1, 5000),
  linea("l", "Leche", "Leche fluida", 2, 3000),
  linea("c", "Café", "Cafe", 1, 4000),
]);
const NOVIEMBRE = ticket("2", "2026-11-10", [
  linea("y", "Yerba", "Yerba mate", 1, 5300),
  linea("l", "Leche", "Leche fluida", 2, 2910),
  linea("c", "Café", "Cafe", 1, 4000),
]);

describe("tuInflacion", () => {
  it("con tres productos en común: la variación ponderada, el que más subió y el que más bajó", () => {
    const r = tuInflacion([OCTUBRE, NOVIEMBRE], "2026-11");
    if (r.estado !== "ok") throw new Error("esperaba ok");
    // Yerba +6 % (peso 5300/12210), leche −3 % (2910/12210), café 0.
    expect(r.variacion).toBeCloseTo((5300 * 0.06 + 2910 * -0.03) / 12210, 6);
    expect(r.masSubio).toEqual({ nombre: "Yerba", variacion: expect.closeTo(0.06, 6) });
    expect(r.masBajo.nombre).toBe("Leche");
    expect(r.comunes).toBe(3);
  });

  it("con dos productos en común no alcanza", () => {
    const solo2 = ticket("3", "2026-11-12", [linea("y", "Yerba", "Yerba mate", 1, 5300), linea("l", "Leche", "Leche fluida", 1, 1500)]);
    expect(tuInflacion([OCTUBRE, solo2], "2026-11")).toEqual({ estado: "sin-datos", comunes: 2 });
  });

  it("el primer mes no tiene con qué comparar", () => {
    expect(tuInflacion([NOVIEMBRE], "2026-11")).toEqual({ estado: "sin-datos", comunes: 0 });
  });
});

describe("gondolaPonderada", () => {
  it("pondera la góndola de las mismas categorías igual que tu inflación", () => {
    const resumen = [
      { categoria: "Yerba mate", variacion_pct: 4 },
      { categoria: "Leche fluida", variacion_pct: 2 },
    ] as InflacionResumen[];
    const pesos = new Map([["Yerba mate", 0.5], ["Leche fluida", 0.25], ["Cafe", 0.25]]);
    // El café no está en el resumen: se pondera entre las que sí.
    expect(gondolaPonderada(pesos, resumen)).toBeCloseTo((0.5 * 0.04 + 0.25 * 0.02) / 0.75, 6);
    expect(gondolaPonderada(new Map([["Cafe", 1]]), resumen)).toBeNull();
  });
});
