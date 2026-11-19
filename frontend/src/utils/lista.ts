/*
  Tu lista se guarda en el navegador, como Tu canasta: sin cuentas ni backend.
  Todos los accesos van envueltos porque en modo incognito o con el storage
  lleno localStorage tira excepcion, y que falle el guardado no puede romper la
  pagina.
*/
import type { ItemLista } from "../types";

const CLAVE = "changuito.lista.v1";
export const MAXIMO_PRODUCTOS = 50;
export const MAXIMO_UNIDADES = 99;

export function leerLista(): ItemLista[] {
  try {
    const crudo = window.localStorage.getItem(CLAVE);
    if (!crudo) return [];
    const datos: unknown = JSON.parse(crudo);
    if (!Array.isArray(datos)) return [];
    return datos
      .filter(
        (x): x is ItemLista =>
          typeof x?.id_producto === "string" && typeof x?.nombre === "string" && Number.isInteger(x?.cantidad)
      )
      .map((x) => ({ ...x, cantidad: Math.min(Math.max(x.cantidad, 1), MAXIMO_UNIDADES) }))
      .slice(0, MAXIMO_PRODUCTOS);
  } catch {
    return [];
  }
}

export function guardarLista(lista: ItemLista[]): void {
  try {
    window.localStorage.setItem(CLAVE, JSON.stringify(lista));
  } catch {
    /* sin persistencia, la lista sigue funcionando en esta visita */
  }
}

export const CLAVE_LISTA = CLAVE;

/** Agrega un producto si no estaba y si la lista no llego al tope; si no,
 *  devuelve la misma lista (el mismo objeto: React no re-renderiza). */
export function agregarALista(lista: ItemLista[], item: ItemLista): ItemLista[] {
  if (lista.some((i) => i.id_producto === item.id_producto) || lista.length >= MAXIMO_PRODUCTOS) return lista;
  return [...lista, { ...item, cantidad: Math.min(Math.max(item.cantidad, 1), MAXIMO_UNIDADES) }];
}

/*
  La lista en un link (openspec compartir-y-pegar-la-lista): viaja entera, sin
  guardar nada en el servidor. /lista?l=<id>x<cant>-<id>x<cant>... Van "x" y "-"
  porque WhatsApp y los navegadores no los escapan (la coma si, %2C). Una
  cantidad 1 no se escribe. La API lee el mismo formato para la tarjeta del link
  (api/compartir.py, productos_en_link).
*/
const ITEM_DEL_LINK = /^(\d{4,14})(?:x(\d{1,2}))?$/;

export function listaALink(lista: Pick<ItemLista, "id_producto" | "cantidad">[]): string {
  return lista
    .slice(0, MAXIMO_PRODUCTOS)
    .map((i) => (i.cantidad > 1 ? `${i.id_producto}x${Math.min(i.cantidad, MAXIMO_UNIDADES)}` : i.id_producto))
    .join("-");
}

/** Los productos de un link: sin codigos invalidos ni repetidos, con las
 *  cantidades en 1..99 y como mucho 50. */
export function listaDelLink(valor: string | null | undefined): { id_producto: string; cantidad: number }[] {
  const vistos = new Set<string>();
  const items: { id_producto: string; cantidad: number }[] = [];
  for (const parte of (valor ?? "").split("-")) {
    const m = ITEM_DEL_LINK.exec(parte.trim());
    if (!m || vistos.has(m[1])) continue;
    vistos.add(m[1]);
    items.push({ id_producto: m[1], cantidad: Math.min(Math.max(Number(m[2] ?? 1), 1), MAXIMO_UNIDADES) });
    if (items.length >= MAXIMO_PRODUCTOS) break;
  }
  return items;
}

/** La lista propia mas la recibida: los nuevos al final y, en un producto
 *  repetido, la cantidad mayor. Respeta el tope de productos. */
export function sumarListas(propia: ItemLista[], recibida: ItemLista[]): ItemLista[] {
  const resultado = propia.map((i) => ({ ...i }));
  for (const item of recibida) {
    const existente = resultado.find((i) => i.id_producto === item.id_producto);
    if (existente) existente.cantidad = Math.max(existente.cantidad, item.cantidad);
    else if (resultado.length < MAXIMO_PRODUCTOS) resultado.push({ ...item });
  }
  return resultado;
}
