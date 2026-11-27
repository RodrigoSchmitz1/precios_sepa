/*
  "Mis tarjetas" (openspec promos-bancarias): los bancos y billeteras que el
  usuario marca. Se guardan solo en el telefono, como Mis gastos y los avisos,
  y no viajan al servidor: el filtro se hace en el navegador.
*/
import { useSyncExternalStore } from "react";
import type { Tarjetas } from "./promosBancarias";

export const CLAVE_TARJETAS = "changuito.tarjetas.v1";
const VACIAS: Tarjetas = { entidades: [], segmentos: [] };

const textos = (x: unknown): string[] => (Array.isArray(x) ? x.filter((s): s is string => typeof s === "string") : []);

export function leerTarjetas(): Tarjetas {
  try {
    const datos = JSON.parse(window.localStorage.getItem(CLAVE_TARJETAS) ?? "null");
    if (!datos || typeof datos !== "object") return VACIAS;
    return { entidades: textos(datos.entidades), segmentos: textos(datos.segmentos) };
  } catch {
    return VACIAS;
  }
}

/** true si quedo guardado; false si el navegador no deja guardar (vale igual en esta visita). */
export function guardarTarjetas(tarjetas: Tarjetas): boolean {
  try {
    window.localStorage.setItem(CLAVE_TARJETAS, JSON.stringify(tarjetas));
    return true;
  } catch {
    return false;
  }
}

/** Marca o desmarca un valor en una lista. */
export function alternar(lista: string[], valor: string): string[] {
  return lista.includes(valor) ? lista.filter((v) => v !== valor) : [...lista, valor];
}

/* ---------------------------------------------------------------------------
   La portada y "Con que pagar" miran las mismas tarjetas: se avisan con un
   evento y useTarjetas se suscribe, como useAvisos.
--------------------------------------------------------------------------- */
const EVENTO = "changuito-tarjetas";
let cache: { crudo: string | null; tarjetas: Tarjetas } = { crudo: null, tarjetas: VACIAS };

function instantanea(): Tarjetas {
  let crudo: string | null;
  try {
    crudo = window.localStorage.getItem(CLAVE_TARJETAS);
  } catch {
    return cache.tarjetas;
  }
  if (crudo !== cache.crudo) cache = { crudo, tarjetas: leerTarjetas() };
  return cache.tarjetas;
}

function suscribir(avisar: () => void): () => void {
  window.addEventListener(EVENTO, avisar);
  window.addEventListener("storage", avisar);
  return () => {
    window.removeEventListener(EVENTO, avisar);
    window.removeEventListener("storage", avisar);
  };
}

export function useTarjetas(): Tarjetas {
  return useSyncExternalStore(suscribir, instantanea, () => VACIAS);
}

/** Guarda y avisa a los demas componentes. Sin almacenamiento, vale solo en memoria. */
export function cambiarTarjetas(tarjetas: Tarjetas): boolean {
  const guardado = guardarTarjetas(tarjetas);
  if (!guardado) cache = { crudo: JSON.stringify(tarjetas), tarjetas };
  window.dispatchEvent(new Event(EVENTO));
  return guardado;
}
