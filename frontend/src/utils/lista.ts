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
