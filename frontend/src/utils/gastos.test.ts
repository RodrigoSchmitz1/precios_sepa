// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Gasto, LineaGasto } from "../types";
import {
  MAXIMO_GASTOS,
  aceptarAviso,
  agregarGasto,
  avisoAceptado,
  borrarTodos,
  buscarDuplicado,
  diferenciaConTotal,
  gastoAMano,
  guardarGastos,
  hoyEnArgentina,
  leerGastos,
} from "./gastos";
import { mesAnteriorDe, mesesConGastos, resumirMes } from "./resumenGastos";

/* Mis gastos en el telefono (openspec mis-gastos-y-barra-nueva). */

const linea = (categoria: string, importe: number): LineaGasto => ({
  descripcion: categoria.toUpperCase(),
  cantidad: 1,
  precio_unitario: importe,
  importe,
  codigo: null,
  id_producto: null,
  nombre: null,
  categoria,
  vinculo: "ninguno",
});

function ticket(cadena: string, fecha: string, total: number, extra: Partial<Gasto> = {}): Gasto {
  return {
    id: `${cadena}-${fecha}-${total}`,
    origen: "foto",
    cadena,
    cadenas_sepa: [cadena],
    sucursal: null,
    fecha,
    comprobante: null,
    total,
    lineas: [linea("Leche", total)],
    descuentos: [],
    creado: 0,
    ...extra,
  };
}

beforeEach(() => window.localStorage.clear());
afterEach(() => vi.restoreAllMocks());

describe("guardado", () => {
  it("guarda y vuelve a leer", () => {
    const gastos = [ticket("Coto", "2026-11-20", 1000)];
    expect(guardarGastos(gastos)).toBe(true);
    expect(leerGastos()).toEqual(gastos);
  });

  it("un localStorage que tira error no rompe", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("bloqueado");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("bloqueado");
    });
    expect(leerGastos()).toEqual([]);
    expect(guardarGastos([ticket("Coto", "2026-11-20", 1000)])).toBe(false);
    expect(avisoAceptado()).toBe(false);
    expect(() => aceptarAviso()).not.toThrow();
  });

  it("descarta lo que no tiene forma de gasto", () => {
    window.localStorage.setItem("changuito.gastos.v1", JSON.stringify([{ id: "x" }, ticket("Dia", "2026-11-01", 5)]));
    expect(leerGastos()).toHaveLength(1);
  });

  it("borrar todo deja el aviso aceptado", () => {
    aceptarAviso();
    guardarGastos([ticket("Coto", "2026-11-20", 1000)]);
    borrarTodos();
    expect(leerGastos()).toEqual([]);
    expect(avisoAceptado()).toBe(true);
  });

  it("no pasa del tope", () => {
    const llenos = Array.from({ length: MAXIMO_GASTOS }, (_, i) => ticket("Coto", "2026-11-20", i + 1));
    expect(agregarGasto(llenos, ticket("Dia", "2026-11-21", 1))).toBeNull();
    expect(agregarGasto(llenos.slice(1), ticket("Dia", "2026-11-21", 1))).toHaveLength(MAXIMO_GASTOS);
  });
});

describe("duplicados", () => {
  const guardado = ticket("Jumbo", "2025-01-09", 3100, { comprobante: "13945-00148992" });

  it("reconoce el mismo ticket", () => {
    expect(buscarDuplicado([guardado], { cadena: "jumbo", comprobante: "13945-00148992", fecha: "2025-01-09", total: 3100 })).toBe(guardado);
  });

  it("otro total u otro comprobante no es el mismo", () => {
    expect(buscarDuplicado([guardado], { cadena: "Jumbo", comprobante: "13945-00148992", fecha: "2025-01-09", total: 3200 })).toBeNull();
    expect(buscarDuplicado([guardado], { cadena: "Jumbo", comprobante: "13945-00148993", fecha: "2025-01-09", total: 3100 })).toBeNull();
  });

  it("sin comprobante no afirma que es el mismo", () => {
    expect(buscarDuplicado([guardado], { cadena: "Jumbo", comprobante: null, fecha: "2025-01-09", total: 3100 })).toBeNull();
  });
});

describe("revisión", () => {
  it("dice cuánto falta para llegar al total impreso", () => {
    expect(diferenciaConTotal([linea("Leche", 30000), linea("Pan", 11500)], [{ importe: 300 }], 43900)).toBe(2700);
  });
});

describe("resumen del mes", () => {
  it("noviembre contra octubre, por súper y por categoría", () => {
    const gastos = [
      ticket("Coto", "2026-11-03", 70000),
      ticket("Coto", "2026-11-17", 50000),
      ticket("Dia", "2026-11-10", 40000),
      ticket("Dia", "2026-11-25", 20000),
      ticket("Coto", "2026-10-15", 150000),
    ];
    const r = resumirMes(gastos, "2026-11");
    expect(r.total).toBe(180000);
    expect(r.mesAnterior).toBe(150000);
    expect(r.variacion).toBeCloseTo(0.2);
    expect(r.porSuper).toEqual([
      { nombre: "Coto", total: 120000 },
      { nombre: "Dia", total: 60000 },
    ]);
    expect(r.gastos.map((g) => g.fecha)).toEqual(["2026-11-25", "2026-11-17", "2026-11-10", "2026-11-03"]);
  });

  it("los descuentos suman ahorro y se reparten entre las categorías", () => {
    const g = ticket("Coto", "2026-11-03", 900, {
      lineas: [linea("Vino", 600), linea("Leche", 400)],
      descuentos: [{ descripcion: "40% VINOS", importe: 100 }],
    });
    const r = resumirMes([g, ticket("Dia", "2026-11-04", 1000, { descuentos: [{ descripcion: "x", importe: 1469 }] })], "2026-11");
    expect(r.ahorroPromos).toBe(1569);
    const vino = r.porCategoria.find((c) => c.nombre === "Vino")!;
    const leche = r.porCategoria.find((c) => c.nombre === "Leche")!;
    expect(vino.total + leche.total).toBeLessThanOrEqual(1000 + 900);
    expect(vino.total).toBeCloseTo(540);
  });

  it("un gasto a mano suma al mes y al súper, en Sin detalle y sin ahorro", () => {
    const r = resumirMes([gastoAMano("Carrefour", "2026-11-20", 25000)], "2026-11");
    expect(r.total).toBe(25000);
    expect(r.porSuper).toEqual([{ nombre: "Carrefour", total: 25000 }]);
    expect(r.porCategoria).toEqual([{ nombre: "Sin detalle", total: 25000 }]);
    expect(r.ahorroPromos).toBe(0);
  });

  it("lo que falta de líneas va a Sin detalle", () => {
    const r = resumirMes([ticket("Coto", "2026-11-03", 43900, { lineas: [linea("Leche", 41200)] })], "2026-11");
    expect(r.porCategoria.find((c) => c.nombre === "Sin detalle")?.total).toBe(2700);
  });

  it("meses y mes anterior sin new Date", () => {
    expect(mesAnteriorDe("2026-01")).toBe("2025-12");
    expect(mesesConGastos([ticket("a", "2026-10-01", 1), ticket("b", "2026-11-30", 1)])).toEqual(["2026-11", "2026-10"]);
    expect(hoyEnArgentina(new Date("2026-11-23T02:00:00Z"))).toBe("2026-11-22");
  });
});
