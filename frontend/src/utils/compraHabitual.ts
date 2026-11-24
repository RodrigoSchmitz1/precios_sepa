/*
  Tu compra habitual (openspec mis-gastos-para-volver): los productos que se
  repiten en tus tickets. De aca salen "lo que compras seguido esta en promo
  cerca" y "donde te conviene la proxima compra", asi las dos secciones hablan
  de los mismos productos. Todo en el telefono, con los tickets ya guardados.
*/
import type { Gasto } from "../types";

export const DIAS_COMPRA_HABITUAL = 90;
export const MINIMO_TICKETS_POR_PRODUCTO = 2;
export const MAXIMO_PRODUCTOS_HABITUALES = 30;
/** Con menos productos repetidos no se habla de "compra habitual". */
export const MINIMO_PRODUCTOS_HABITUALES = 3;

export type ProductoHabitual = { id_producto: string; descripcion: string; cantidad: number; tickets: number };

/** AAAA-MM-DD de hace n dias, sin new Date("AAAA-MM-DD") (corre un dia en la Argentina). */
export function fechaHaceDias(hoy: string, dias: number): string {
  const [a, m, d] = hoy.split("-").map(Number);
  const fecha = new Date(Date.UTC(a, m - 1, d - dias));
  return fecha.toISOString().slice(0, 10);
}

function mediana(valores: number[]): number {
  const orden = [...valores].sort((x, y) => x - y);
  const medio = Math.floor(orden.length / 2);
  return orden.length % 2 ? orden[medio] : (orden[medio - 1] + orden[medio]) / 2;
}

export function compraHabitual(gastos: Gasto[], hoy: string): ProductoHabitual[] {
  const desde = fechaHaceDias(hoy, DIAS_COMPRA_HABITUAL);
  const porProducto = new Map<string, { descripcion: string; cantidades: number[]; tickets: Set<string>; importe: number }>();
  for (const g of gastos) {
    if (g.origen !== "foto" || g.fecha < desde || g.fecha > hoy) continue;
    for (const l of g.lineas) {
      if (!l.id_producto || l.importe <= 0) continue;
      const p = porProducto.get(l.id_producto) ?? { descripcion: l.nombre ?? l.descripcion, cantidades: [], tickets: new Set(), importe: 0 };
      p.cantidades.push(Math.max(1, Math.round(l.cantidad)));
      p.tickets.add(g.id);
      p.importe += l.importe;
      porProducto.set(l.id_producto, p);
    }
  }
  const habituales = [...porProducto.entries()]
    .filter(([, p]) => p.tickets.size >= MINIMO_TICKETS_POR_PRODUCTO)
    .sort((a, b) => b[1].tickets.size - a[1].tickets.size || b[1].importe - a[1].importe)
    .slice(0, MAXIMO_PRODUCTOS_HABITUALES)
    .map(([id_producto, p]) => ({
      id_producto,
      descripcion: p.descripcion,
      cantidad: Math.max(1, Math.round(mediana(p.cantidades))),
      tickets: p.tickets.size,
    }));
  return habituales.length >= MINIMO_PRODUCTOS_HABITUALES ? habituales : [];
}
