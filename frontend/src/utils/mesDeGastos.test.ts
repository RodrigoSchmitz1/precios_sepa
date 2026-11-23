import { describe, expect, it } from "vitest";
import type { Gasto, LineaGasto, OpcionDondeComprar, ResultadoDondeComprar } from "../types";
import { compararMes, productosDelMes } from "./mesDeGastos";

/* Tu mes en la cadena mas barata de tu zona, y mezclando dos (openspec promos-navegables-y-mes-en-gastos). */

const linea = (id: string | null, importe: number, cantidad = 1): LineaGasto => ({
  descripcion: `PRODUCTO ${id}`, cantidad, precio_unitario: importe / cantidad, importe, codigo: id, id_producto: id,
  nombre: null, categoria: "Almacen", vinculo: id ? "codigo" : "ninguno",
});

const ticket = (id: string, fecha: string, lineas: LineaGasto[], cadena = "COTO", sepa = ["Coto"]): Gasto => ({
  id, origen: "foto", cadena, cadenas_sepa: sepa, sucursal: null, fecha, comprobante: id,
  total: lineas.reduce((s, l) => s + l.importe, 0), lineas, descuentos: [], creado: 0,
});

const aMano = (fecha: string, total: number): Gasto => ({
  id: "m", origen: "mano", cadena: "Dia", cadenas_sepa: [], sucursal: null, fecha, comprobante: null, total, lineas: [], descuentos: [], creado: 0,
});

const sucursal = (cadena: string, ids: string[], subtotal: number) => ({
  id: cadena, cadena, nombre_sucursal: cadena, direccion: null, localidad: "Caballito", provincia: "AR-C", latitud: 0, longitud: 0,
  distancia_km: 1, subtotal,
  productos: ids.map((id) => ({ id_producto: id, descripcion: `PRODUCTO ${id}`, cantidad: 1, precio_unitario: 1, costo: 1 })),
});

const opcion = (max: number, total: number, sucursales: ReturnType<typeof sucursal>[]): OpcionDondeComprar => ({
  max_sucursales: max, total, productos_cubiertos: new Set(sucursales.flatMap((s) => s.productos.map((p) => p.id_producto))).size,
  distancia_suma_km: 1, sucursales,
});

const resultado = (...opciones: OpcionDondeComprar[]): ResultadoDondeComprar => ({ radio_km: 3, productos: 3, sin_precio_cerca: [], opciones });

// Noviembre: $ 180.000 de productos vinculados en dos tickets de Coto, y $ 20.000 sin vincular.
const NOVIEMBRE = [
  ticket("1", "2026-11-03", [linea("a", 100000, 2), linea(null, 20000)]),
  ticket("2", "2026-11-20", [linea("b", 50000), linea("c", 30000), linea("a", 0)]),
  ticket("3", "2026-10-28", [linea("z", 99999)]),
  aMano("2026-11-10", 50000),
];

describe("productosDelMes", () => {
  it("junta los productos vinculados del mes, sin gastos a mano ni otros meses", () => {
    const d = productosDelMes(NOVIEMBRE, "2026-11");
    expect(d.items).toEqual([
      { id_producto: "a", cantidad: 2 },
      { id_producto: "b", cantidad: 1 },
      { id_producto: "c", cantidad: 1 },
    ]);
    expect(d.importes).toEqual({ a: 100000, b: 50000, c: 30000 });
    expect(d.bruto).toBe(200000);
    expect(d.recortados).toBe(0);
  });

  it("con más productos que el tope, usa los de mayor importe", () => {
    const lineas = Array.from({ length: 60 }, (_, n) => linea(`p${n}`, 1000 + n));
    const d = productosDelMes([ticket("1", "2026-11-03", lineas)], "2026-11");
    expect(d.items).toHaveLength(50);
    expect(d.recortados).toBe(10);
    expect(d.items[0].id_producto).toBe("p59");
  });
});

describe("compararMes", () => {
  const datos = productosDelMes(NOVIEMBRE, "2026-11");

  it("noviembre en Día: la más barata, cuánto menos y a precio de lista", () => {
    const c = compararMes(datos, resultado(opcion(1, 162000, [sucursal("Dia", ["a", "b", "c"], 162000)])), 0.6);
    expect(c).toMatchObject({ estado: "ok", cadena: "Dia", total: 162000, pagado: 180000, productos: 3, yaEsLaMasBarata: false, mezcla: null });
  });

  it("mezclando Día y Coto, sobre los mismos productos", () => {
    const c = compararMes(
      datos,
      resultado(
        opcion(1, 162000, [sucursal("Dia", ["a", "b", "c"], 162000)]),
        opcion(2, 151000, [sucursal("Dia", ["a"], 90000), sucursal("Coto", ["b", "c"], 61000)]),
      ),
      0.6,
    );
    expect(c.estado === "ok" && c.mezcla).toEqual({
      total: 151000,
      ahorroContraUna: 11000,
      partes: [
        { cadena: "Dia", productos: ["PRODUCTO a"], subtotal: 90000 },
        { cadena: "Coto", productos: ["PRODUCTO b", "PRODUCTO c"], subtotal: 61000 },
      ],
    });
  });

  it("mezclar no conviene si no baja el total o es la misma cadena", () => {
    const una = opcion(1, 162000, [sucursal("Dia", ["a", "b", "c"], 162000)]);
    const igual = compararMes(datos, resultado(una, opcion(2, 162000, [sucursal("Dia", ["a", "b", "c"], 162000)])), 0.6);
    expect(igual.estado === "ok" && igual.mezcla).toBeNull();
    const dosDia = opcion(2, 150000, [sucursal("Dia", ["a"], 90000), sucursal("DIA", ["b", "c"], 60000)]);
    const misma = compararMes(datos, resultado(una, dosDia), 0.6);
    expect(misma.estado === "ok" && misma.mezcla).toBeNull();
  });

  it("ya compró en la más barata", () => {
    const deDia = [ticket("1", "2026-11-03", [linea("a", 100000)], "DIA", ["Dia"])];
    const c = compararMes(productosDelMes(deDia, "2026-11"), resultado(opcion(1, 95000, [sucursal("Dia", ["a"], 95000)])), 0.6);
    expect(c).toMatchObject({ estado: "ok", yaEsLaMasBarata: true });
  });

  it("poco vinculado: no compara", () => {
    const poco = [ticket("1", "2026-11-03", [linea("a", 40000), linea(null, 160000)])];
    expect(compararMes(productosDelMes(poco, "2026-11"), null, 0.6)).toEqual({ estado: "poca-cobertura", cobertura: 0.2 });
  });

  it("la cadena cubre poco de lo del mes: no compara", () => {
    const c = compararMes(datos, resultado(opcion(1, 30000, [sucursal("Dia", ["c"], 30000)])), 0.6);
    expect(c).toEqual({ estado: "poca-cobertura", cobertura: 0.15 });
  });

  it("solo gastos a mano: nada que comparar", () => {
    expect(compararMes(productosDelMes([aMano("2026-11-10", 5000)], "2026-11"), null, 0.6)).toEqual({ estado: "sin-tickets" });
  });

  it("sin súper cerca", () => {
    expect(compararMes(datos, resultado(), 0.6)).toEqual({ estado: "sin-cadena" });
  });
});
