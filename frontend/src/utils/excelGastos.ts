/*
  "Bajar a Excel" en Mis gastos (openspec mis-gastos-y-barra-nueva). Un .xlsx y
  no un CSV: Excel en es-AR espera ";" y coma decimal, y un CSV mal abierto
  rompe los montos. SheetJS se carga con import() recien al tocar el boton,
  asi no pesa en la carga de la pagina.
*/
import type { Gasto } from "../types";
import { nombreCategoria } from "./nombres";

type XLSX = typeof import("xlsx");

/** "2026-11-20" -> "20/11/2026", armado a mano (sin new Date). */
export function fechaDeExcel(iso: string): string {
  const [anio, mes, dia] = iso.split("-");
  return `${dia}/${mes}/${anio}`;
}

export function filasGastos(gastos: Gasto[]): (string | number)[][] {
  const ordenados = [...gastos].sort((a, b) => a.fecha.localeCompare(b.fecha) || a.creado - b.creado);
  return [
    ["Fecha", "Súper", "Total", "Ahorro en promos", "Origen"],
    ...ordenados.map((g) => [
      fechaDeExcel(g.fecha),
      g.cadena,
      g.total,
      g.descuentos.reduce((s, d) => s + d.importe, 0),
      g.origen === "foto" ? "Foto del ticket" : "Anotado a mano",
    ]),
  ];
}

export function filasLineas(gastos: Gasto[]): (string | number)[][] {
  const ordenados = [...gastos].sort((a, b) => a.fecha.localeCompare(b.fecha) || a.creado - b.creado);
  return [
    ["Fecha", "Súper", "Descripción del ticket", "Producto", "Categoría", "Cantidad", "Precio", "Importe"],
    ...ordenados.flatMap((g) =>
      g.lineas.map((l) => [
        fechaDeExcel(g.fecha),
        g.cadena,
        l.descripcion,
        l.nombre ?? "",
        nombreCategoria(l.categoria),
        l.cantidad,
        l.precio_unitario,
        l.importe,
      ]),
    ),
  ];
}

export function armarLibro(xlsx: XLSX, gastos: Gasto[]) {
  const libro = xlsx.utils.book_new();
  xlsx.utils.book_append_sheet(libro, xlsx.utils.aoa_to_sheet(filasGastos(gastos)), "Gastos");
  xlsx.utils.book_append_sheet(libro, xlsx.utils.aoa_to_sheet(filasLineas(gastos)), "Líneas");
  return libro;
}

export async function bajarExcel(gastos: Gasto[], hoy: string): Promise<void> {
  const xlsx = await import("xlsx");
  xlsx.writeFile(armarLibro(xlsx, gastos), `mis-gastos-changuito-${hoy}.xlsx`);
}
