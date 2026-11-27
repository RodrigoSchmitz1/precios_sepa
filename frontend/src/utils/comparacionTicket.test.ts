import * as XLSX from "xlsx";
import { describe, expect, it } from "vitest";
import type { Gasto, LineaGasto, ResultadoLista } from "../types";
import { compararConPrecios, compararTicket, itemsDelTicket } from "./comparacionTicket";
import { armarLibro } from "./excelGastos";
import { medidasAchicadas } from "./fotos";

/* Comparación, Excel y fotos de Mis gastos (openspec mis-gastos-y-barra-nueva). */

const linea = (id: string | null, importe: number, cantidad = 1): LineaGasto => ({
  descripcion: id ?? "SIN",
  cantidad,
  precio_unitario: importe / cantidad,
  importe,
  codigo: id,
  id_producto: id,
  nombre: id,
  categoria: "Almacen",
  vinculo: id ? "codigo" : "ninguno",
});

const gasto = (lineas: LineaGasto[], extra: Partial<Gasto> = {}): Gasto => ({
  id: "g",
  origen: "foto",
  cadena: "COTO",
  cadenas_sepa: ["Coto"],
  sucursal: null,
  fecha: "2026-11-20",
  comprobante: null,
  total: lineas.reduce((s, l) => s + l.importe, 0),
  lineas,
  descuentos: [],
  creado: 0,
  ...extra,
});

const fila = (cadena: string, total: number, productos: number, completa = true) => ({
  cadena, total, productos_con_precio: productos, completa, faltan: [],
});

const cotizacion = (zona: ReturnType<typeof fila>[]): ResultadoLista => ({
  productos: [], no_encontrados: [], cadenas: [], combinando_cadenas: 0, fecha_datos: null,
  zona: { cadenas: zona, combinando_cadenas: 0, no_en_zona: [], mas_barato: {} },
});

describe("hubieras pagado", () => {
  // Ticket de $ 40.000 con productos vinculados por $ 36.000.
  const ticket = gasto([linea("a", 20000), linea("b", 16000), linea(null, 4000)]);

  it("compara contra la cadena de la zona más barata que tiene todo", () => {
    const datos = itemsDelTicket(ticket);
    expect(datos.pagado).toBe(36000);
    expect(datos.cobertura).toBeCloseTo(0.9);
    const r = compararTicket(ticket, datos, cotizacion([fila("Coto", 36000, 2), fila("Día", 31000, 2), fila("Vea", 29000, 1, false)]), 0.6);
    expect(r).toEqual({ estado: "ok", pagado: 36000, cadena: "Día", total: 31000, diferencia: 5000, esLaMisma: false });
  });

  it("no compara con pocos productos vinculados", () => {
    const pocos = gasto([linea("a", 8000), linea(null, 32000)]);
    expect(compararTicket(pocos, itemsDelTicket(pocos), cotizacion([fila("Día", 7000, 1)]), 0.6).estado).toBe("poca-cobertura");
  });

  it("sin zona o sin cadena completa no compara", () => {
    const datos = itemsDelTicket(ticket);
    expect(compararTicket(ticket, datos, { ...cotizacion([]), zona: undefined }, 0.6).estado).toBe("sin-zona");
    expect(compararTicket(ticket, datos, cotizacion([fila("Día", 31000, 1, false)]), 0.6).estado).toBe("sin-cadena-completa");
  });

  it("suma cantidades del mismo producto en varias líneas", () => {
    const datos = itemsDelTicket(gasto([linea("a", 1000), linea("a", 1000), linea("b", 500, 2)]));
    expect(datos.items).toEqual([{ id_producto: "a", cantidad: 2 }, { id_producto: "b", cantidad: 2 }]);
  });
});

describe("comparar todos los tickets con una sola cotización (app-para-el-usuario)", () => {
  it("con los precios por cadena da lo mismo que cotizar el ticket", () => {
    const ticket = gasto([linea("a", 20000), linea("b", 16000), linea(null, 4000)]);
    const precios = { a: { Coto: 20000, Día: 17000, Vea: 15000 }, b: { Coto: 16000, Día: 14000 } };
    const r = compararConPrecios(ticket, precios, new Set(["Coto", "Día", "Vea"]), 0.6);
    expect(r).toEqual({ estado: "ok", pagado: 36000, cadena: "Día", total: 31000, diferencia: 5000, esLaMisma: false });
  });

  it("una cadena de afuera de la zona no cuenta", () => {
    const ticket = gasto([linea("a", 20000)]);
    const r = compararConPrecios(ticket, { a: { Maxi: 10000, Coto: 20000 } }, new Set(["Coto"]), 0.6);
    expect(r).toMatchObject({ estado: "ok", cadena: "Coto", esLaMisma: true });
  });
});

describe("Excel", () => {
  it("una hoja de gastos y una de líneas, con montos numéricos", () => {
    const gastos = Array.from({ length: 10 }, (_, i) =>
      gasto(Array.from({ length: 12 }, (_, j) => linea(`p${j}`, 100 + j)), { id: `g${i}`, fecha: `2026-11-${String(i + 1).padStart(2, "0")}` }),
    );
    const libro = armarLibro(XLSX, gastos);
    expect(libro.SheetNames).toEqual(["Gastos", "Líneas"]);
    const filasGastos = XLSX.utils.sheet_to_json<Record<string, unknown>>(libro.Sheets.Gastos);
    const filasLineas = XLSX.utils.sheet_to_json<Record<string, unknown>>(libro.Sheets["Líneas"]);
    expect(filasGastos).toHaveLength(10);
    expect(filasLineas).toHaveLength(120);
    expect(typeof filasGastos[0].Total).toBe("number");
    expect(typeof filasLineas[0].Importe).toBe("number");
    expect(filasGastos[0].Fecha).toBe("01/11/2026");
  });
});

describe("fotos", () => {
  it("una foto de 4.000 px sale con el lado largo de 1.600", () => {
    expect(medidasAchicadas(3000, 4000)).toEqual({ ancho: 1200, alto: 1600 });
    expect(medidasAchicadas(800, 600)).toEqual({ ancho: 800, alto: 600 });
  });
});
