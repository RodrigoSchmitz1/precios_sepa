/*
  La regla de "mezclando dos cadenas", en un solo lugar: la usan el resumen del
  mes (mesDeGastos.ts) y la proxima compra (openspec mis-gastos-para-volver).

  Mezclar se compara contra la mejor sucursal sola sobre los MISMOS productos, y
  solo cuenta si de verdad son dos cadenas distintas y baja el total.
*/
import type { OpcionDondeComprar } from "../types";

export type ParteMezcla = { cadena: string; productos: string[]; subtotal: number };
export type Mezcla = { total: number; ahorroContraUna: number; partes: ParteMezcla[] };

const normal = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

export function cubiertos(opcion: OpcionDondeComprar): Set<string> {
  return new Set(opcion.sucursales.flatMap((s) => s.productos.map((p) => p.id_producto)));
}

export function mezclaQueConviene(una: OpcionDondeComprar, dos: OpcionDondeComprar | undefined): Mezcla | null {
  if (!dos) return null;
  const ids = cubiertos(una);
  const idsDos = cubiertos(dos);
  const mismos = idsDos.size === ids.size && [...ids].every((id) => idsDos.has(id));
  const cadenas = new Set(dos.sucursales.map((s) => normal(s.cadena)));
  if (!mismos || cadenas.size !== 2 || dos.total >= una.total - 0.5) return null;
  return {
    total: dos.total,
    ahorroContraUna: Math.round((una.total - dos.total) * 100) / 100,
    partes: dos.sucursales.map((s) => ({ cadena: s.cadena, productos: s.productos.map((p) => p.descripcion), subtotal: s.subtotal })),
  };
}

/** La mejor opcion de una sola sucursal, si la hay. */
export function opcionDeUna(opciones: OpcionDondeComprar[]): OpcionDondeComprar | undefined {
  return opciones.find((o) => o.max_sucursales === 1 && o.sucursales.length === 1);
}

export function opcionDeDos(opciones: OpcionDondeComprar[]): OpcionDondeComprar | undefined {
  return opciones.find((o) => o.max_sucursales === 2);
}
