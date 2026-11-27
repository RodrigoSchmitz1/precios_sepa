/*
  Lo que compras seguido se vigila solo (openspec app-para-el-usuario): los
  productos de la compra habitual de Mis gastos cuentan como avisos sin que el
  usuario los pida, no ocupan lugar en el tope de 50 y se pueden silenciar. Es
  parte de lo que gana el usuario por cargar tickets.
*/
import type { Aviso } from "./avisos";
import type { ProductoHabitual } from "./compraHabitual";

const CLAVE_SILENCIADOS = "changuito.vigilados.silenciados.v1";

export type Vigilado = { id_producto: string; descripcion: string; seguido: boolean };

export function leerSilenciados(): string[] {
  try {
    const datos: unknown = JSON.parse(window.localStorage.getItem(CLAVE_SILENCIADOS) ?? "[]");
    return Array.isArray(datos) ? datos.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

/** Devuelve los silenciados que quedan (aunque el navegador no deje guardar, en esta visita vale). */
export function silenciar(idProducto: string): string[] {
  const silenciados = [...new Set([...leerSilenciados(), idProducto])];
  try {
    window.localStorage.setItem(CLAVE_SILENCIADOS, JSON.stringify(silenciados));
  } catch {
    /* sin persistencia vuelve en la proxima visita: no rompe nada */
  }
  return silenciados;
}

/** Los avisos pedidos primero, despues lo que compras seguido que no esta silenciado ni repetido. */
export function vigilados(avisos: Aviso[], habitual: ProductoHabitual[], silenciados: string[]): Vigilado[] {
  const lista: Vigilado[] = avisos.map((a) => ({ id_producto: a.id_producto, descripcion: a.descripcion, seguido: false }));
  const ya = new Set(lista.map((v) => v.id_producto));
  for (const p of habitual) {
    if (ya.has(p.id_producto) || silenciados.includes(p.id_producto)) continue;
    lista.push({ id_producto: p.id_producto, descripcion: p.descripcion, seguido: true });
    ya.add(p.id_producto);
  }
  return lista;
}
