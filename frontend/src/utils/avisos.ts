/*
  "Avisame cuando este de oferta" (openspec promos-navegables-y-mes-en-gastos).

  Los avisos se guardan en el navegador, como Mi compra y Mis gastos: sin
  cuenta y sin mandarlos al servidor, salvo los id_producto para buscar sus
  promos cerca. Cada acceso va envuelto: en modo incognito o con el
  almacenamiento lleno localStorage tira excepcion.

  Varios componentes miran los mismos avisos (el boton del detalle, el de cada
  promo y el bloque de la vidriera): avisan con un evento y useAvisos se
  suscribe con useSyncExternalStore.
*/
import { useSyncExternalStore } from "react";

export type Aviso = { id_producto: string; descripcion: string; desde: string };

const CLAVE = "changuito.avisos.v1";
const EVENTO = "changuito-avisos";
/** Por debajo del tope de /promos/productos (100 por pedido). */
export const MAXIMO_AVISOS = 50;

function esAviso(x: unknown): x is Aviso {
  const a = x as Aviso;
  return typeof a?.id_producto === "string" && a.id_producto !== "" && typeof a.descripcion === "string";
}

let cache: { crudo: string | null; avisos: Aviso[] } = { crudo: null, avisos: [] };

export function leerAvisos(): Aviso[] {
  try {
    const crudo = window.localStorage.getItem(CLAVE);
    // useSyncExternalStore exige devolver el mismo arreglo si nada cambio.
    if (crudo === cache.crudo) return cache.avisos;
    let avisos: Aviso[] = [];
    if (crudo) {
      const datos: unknown = JSON.parse(crudo);
      avisos = Array.isArray(datos) ? datos.filter(esAviso).slice(0, MAXIMO_AVISOS) : [];
    }
    cache = { crudo, avisos };
    return avisos;
  } catch {
    return cache.avisos;
  }
}

/** true si quedo guardado; false si el navegador no deja guardar. */
function guardar(avisos: Aviso[]): boolean {
  try {
    window.localStorage.setItem(CLAVE, JSON.stringify(avisos));
  } catch {
    return false;
  }
  window.dispatchEvent(new Event(EVENTO));
  return true;
}

export type ResultadoAviso = "agregado" | "sacado" | "tope" | "sin-guardar";

/** Agrega o saca el producto de los avisos. */
export function alternarAviso(producto: { id_producto: string; descripcion: string }, hoy: string): ResultadoAviso {
  const avisos = leerAvisos();
  if (avisos.some((a) => a.id_producto === producto.id_producto)) {
    return guardar(avisos.filter((a) => a.id_producto !== producto.id_producto)) ? "sacado" : "sin-guardar";
  }
  if (avisos.length >= MAXIMO_AVISOS) return "tope";
  const nuevo = { id_producto: producto.id_producto, descripcion: producto.descripcion, desde: hoy };
  return guardar([...avisos, nuevo]) ? "agregado" : "sin-guardar";
}

export function sacarAviso(idProducto: string): boolean {
  return guardar(leerAvisos().filter((a) => a.id_producto !== idProducto));
}

function suscribir(avisar: () => void): () => void {
  window.addEventListener(EVENTO, avisar);
  // Otra pestaña del mismo telefono.
  window.addEventListener("storage", avisar);
  return () => {
    window.removeEventListener(EVENTO, avisar);
    window.removeEventListener("storage", avisar);
  };
}

const SIN_AVISOS: Aviso[] = [];

export function useAvisos(): Aviso[] {
  return useSyncExternalStore(suscribir, leerAvisos, () => SIN_AVISOS);
}
