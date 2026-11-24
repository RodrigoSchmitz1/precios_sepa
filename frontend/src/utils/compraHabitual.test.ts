// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Gasto, LineaGasto } from "../types";
import { compraHabitual, fechaHaceDias } from "./compraHabitual";
import { avancePresupuesto, guardarPresupuesto, leerPresupuesto } from "./presupuesto";
import { rachaDeSemanas, resumirMes, textoInformeDelMes } from "./resumenGastos";

/* Mis gastos para volver (openspec mis-gastos-para-volver). */

const linea = (id: string | null, importe: number, cantidad = 1, categoria = "Almacen"): LineaGasto => ({
  descripcion: `PRODUCTO ${id}`, cantidad, precio_unitario: importe / cantidad, importe, codigo: id, id_producto: id,
  nombre: id ? `Producto ${id}` : null, categoria, vinculo: id ? "codigo" : "ninguno",
});

const ticket = (id: string, fecha: string, lineas: LineaGasto[], origen: "foto" | "mano" = "foto"): Gasto => ({
  id, origen, cadena: "COTO", cadenas_sepa: ["Coto"], sucursal: null, fecha, comprobante: id,
  total: lineas.reduce((s, l) => s + l.importe, 0) || 1000, lineas, descuentos: [], creado: 0,
});

describe("compra habitual", () => {
  const HOY = "2026-11-24";

  it("productos en al menos dos tickets de los últimos 90 días, por veces y cantidad típica", () => {
    const gastos = [
      ticket("1", "2026-11-20", [linea("yerba", 5000, 2), linea("aceite", 4000), linea("pan", 1000), linea("una vez", 900)]),
      ticket("2", "2026-11-10", [linea("yerba", 5000, 2), linea("aceite", 4000), linea("pan", 1000)]),
      ticket("3", "2026-10-30", [linea("yerba", 2500, 1), linea("pan", 1000)]),
      ticket("viejo", "2026-07-01", [linea("aceite", 4000), linea("una vez", 900)]),
      ticket("mano", "2026-11-21", [], "mano"),
    ];
    const habitual = compraHabitual(gastos, HOY);
    expect(habitual.map((p) => [p.id_producto, p.tickets, p.cantidad])).toEqual([
      ["yerba", 3, 2],
      ["pan", 3, 1],
      ["aceite", 2, 1],
    ]);
  });

  it("con menos de tres productos repetidos no hay compra habitual", () => {
    const gastos = [ticket("1", "2026-11-20", [linea("yerba", 5000), linea("pan", 1000)]), ticket("2", "2026-11-10", [linea("yerba", 5000), linea("pan", 1000)])];
    expect(compraHabitual(gastos, HOY)).toEqual([]);
  });

  it("hace 90 días sin new Date de texto", () => {
    expect(fechaHaceDias("2026-11-24", 90)).toBe("2026-08-26");
    expect(fechaHaceDias("2026-03-01", 1)).toBe("2026-02-28");
  });
});

describe("presupuesto", () => {
  beforeEach(() => window.localStorage.clear());
  afterEach(() => vi.restoreAllMocks());

  it("avance, cerca del tope y pasado", () => {
    expect(avancePresupuesto(150000, 300000)).toEqual({ fraccion: 0.5, queda: 150000, estado: "bien" });
    expect(avancePresupuesto(255000, 300000)).toMatchObject({ queda: 45000, estado: "cerca" });
    expect(avancePresupuesto(320000, 300000)).toMatchObject({ queda: -20000, estado: "pasado" });
  });

  it("se guarda, se cambia y se saca", () => {
    expect(leerPresupuesto()).toBeNull();
    expect(guardarPresupuesto(300000)).toBe(true);
    expect(leerPresupuesto()).toBe(300000);
    guardarPresupuesto(null);
    expect(leerPresupuesto()).toBeNull();
  });

  it("sin almacenamiento dice que no se guardó", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("QuotaExceededError");
    });
    expect(guardarPresupuesto(1000)).toBe(false);
  });
});

describe("racha e informe del mes", () => {
  const g = (fecha: string) => ticket(fecha, fecha, [linea("x", 1000)]);

  it("semanas seguidas terminando en la actual o en la anterior", () => {
    // Martes 24-11; semanas que empiezan el 23, 16 y 9 de noviembre.
    expect(rachaDeSemanas([g("2026-11-24"), g("2026-11-17"), g("2026-11-09")], "2026-11-24")).toBe(3);
    // Esta semana sin cargar: cuenta desde la anterior.
    expect(rachaDeSemanas([g("2026-11-18"), g("2026-11-12")], "2026-11-24")).toBe(2);
    // Un hueco corta la racha.
    expect(rachaDeSemanas([g("2026-11-24"), g("2026-11-02")], "2026-11-24")).toBe(1);
    expect(rachaDeSemanas([], "2026-11-24")).toBe(0);
  });

  it("el texto del informe sale del mismo resumen y no nombra supers", () => {
    const gastos = [
      { ...ticket("a", "2026-11-05", [linea("x", 120000, 1, "Almacen"), linea("y", 60000, 1, "Limpieza")]), descuentos: [{ descripcion: "PROMO", importe: 6000 }] },
      ticket("b", "2026-10-05", [linea("z", 200000)]),
    ];
    gastos[0].total = 174000;
    const texto = textoInformeDelMes(resumirMes(gastos, "2026-11")).replaceAll(String.fromCharCode(160), " ");
    expect(texto).toContain("noviembre 2026");
    expect(texto).toContain("$ 174.000");
    expect(texto).toContain("13% menos que el mes anterior");
    expect(texto).toContain("Almacen");
    expect(texto).toContain("ahorré $ 6.000 en promos");
    expect(texto).not.toContain("COTO");
  });
});
