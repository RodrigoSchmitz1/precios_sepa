import { describe, expect, it } from "vitest";
import type { Gasto } from "../types";
import { comprasPorSuper, encabezadoDeDia, gastoPorDia, porDia, semanasDelMes } from "./resumenGastos";

/* Calculos de Mis gastos como app (openspec mis-gastos-como-app). */

const g = (cadena: string, fecha: string, total: number): Gasto => ({
  id: `${cadena}${fecha}${total}`, origen: "mano", cadena, cadenas_sepa: [], sucursal: null, fecha, comprobante: null, total,
  lineas: [], descuentos: [], creado: 0,
});

describe("semanasDelMes", () => {
  it("reparte el mes en cinco tramos y deja afuera otros meses", () => {
    const tramos = semanasDelMes(
      [g("Coto", "2026-11-03", 100), g("Dia", "2026-11-07", 50), g("Coto", "2026-11-08", 30), g("Coto", "2026-11-30", 20), g("Coto", "2026-10-03", 999)],
      "2026-11",
    );
    expect(tramos).toEqual([
      { etiqueta: "1–7", total: 150 },
      { etiqueta: "8–14", total: 30 },
      { etiqueta: "15–21", total: 0 },
      { etiqueta: "22–28", total: 0 },
      { etiqueta: "29–30", total: 20 },
    ]);
  });

  it("un febrero de 28 días tiene cuatro tramos", () => {
    expect(semanasDelMes([], "2027-02").map((t) => t.etiqueta)).toEqual(["1–7", "8–14", "15–21", "22–28"]);
  });

  it("un mes de 29 días termina con el tramo de un día", () => {
    expect(semanasDelMes([], "2028-02").at(-1)?.etiqueta).toBe("29");
  });
});

describe("comprasPorSuper y gastoPorDia", () => {
  it("cuenta las compras de cada súper", () => {
    expect(comprasPorSuper([g("Coto", "2026-11-01", 1), g("Coto", "2026-11-02", 1), g("Dia", "2026-11-02", 1)])).toEqual(
      new Map([["Coto", 2], ["Dia", 1]]),
    );
  });

  it("en el mes en curso divide por los días que pasaron; en uno terminado, por todos", () => {
    expect(gastoPorDia(52000, "2026-11", "2026-11-26")).toBe(2000);
    expect(gastoPorDia(31000, "2026-10", "2026-11-26")).toBe(1000);
  });
});

describe("encabezadoDeDia y porDia", () => {
  it("hoy, ayer y el día de la semana", () => {
    expect(encabezadoDeDia("2026-11-26", "2026-11-26")).toBe("Hoy · 26 nov");
    expect(encabezadoDeDia("2026-11-25", "2026-11-26")).toBe("Ayer · 25 nov");
    expect(encabezadoDeDia("2026-11-20", "2026-11-26")).toBe("Viernes 20 nov");
    expect(encabezadoDeDia("2026-12-31", "2027-01-01")).toBe("Ayer · 31 dic");
  });

  it("junta los tickets del mismo día en el orden en que vienen", () => {
    const grupos = porDia([g("Coto", "2026-11-20", 1), g("Dia", "2026-11-20", 2), g("Coto", "2026-11-12", 3)]);
    expect(grupos.map((x) => [x.fecha, x.gastos.length])).toEqual([["2026-11-20", 2], ["2026-11-12", 1]]);
  });
});
