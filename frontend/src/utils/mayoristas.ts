import type { PrecioMayorista } from "../types";
import { formatearPesos } from "./formato";

/*
  Lo que dicen las pantallas de un mayorista (openspec sumar-mayoristas).

  El precio y las promos de un mayorista son por unidad comprando el bulto: la
  etiqueta va en cada lugar donde aparece (promos, mapa, vidriera) para que no se
  lea como el precio de un súper.
*/

/** "mayorista · bulto de 6", "mayorista" si vende por unidad, o null si no es mayorista. */
export function etiquetaMayorista(p: { mayorista?: boolean; unidades_bulto?: number | null }): string | null {
  if (!p.mayorista) return null;
  return p.unidades_bulto && p.unidades_bulto > 1 ? `mayorista · bulto de ${p.unidades_bulto}` : "mayorista";
}

/** El titulo de la fila de una cadena en la vidriera. Un mayorista lo dice
 *  adelante y corto ("Mayorista Yaguar hoy"): a 375 px, con "Ver en el mapa"
 *  al lado, "Lo mejor de Yaguar hoy · mayorista" quedaba cortado. */
export function tituloFilaCadena(c: { cadena: string; mayorista?: boolean }): string {
  if (!c.mayorista) return `Lo mejor de ${c.cadena} hoy`;
  return /mayorista/i.test(c.cadena) ? `${c.cadena} hoy` : `Mayorista ${c.cadena} hoy`;
}

/** "15% menos" / "4% más" / "lo mismo" por unidad, contra el súper más barato. */
export function diferenciaContraSuper(precio: number, precioSuper: number): string {
  const pct = Math.round((precio / precioSuper - 1) * 100);
  if (pct === 0) return "lo mismo por unidad que";
  return pct < 0 ? `${-pct}% menos por unidad que` : `${pct}% más por unidad que`;
}

/** "comprando el bulto de 12 ($ 23.758)" o "por unidad" si vende de a una. */
export function textoBulto(m: Pick<PrecioMayorista, "unidades_bulto" | "precio_bulto">): string {
  if (!m.unidades_bulto || m.unidades_bulto <= 1) return "por unidad";
  const bulto = m.precio_bulto ? ` (${formatearPesos(m.precio_bulto)})` : "";
  return `comprando el bulto de ${m.unidades_bulto}${bulto}`;
}
