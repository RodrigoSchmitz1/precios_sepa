import type { CambioDePrecio } from "../types";
import { fechaCorta, formatearPesos } from "./formato";

/*
  Los textos del cambio de precio (openspec historia-de-precio).

  Que cambio se cuenta (reciente, de 3% o mas, el precio de hoy) lo decide
  mart_cambio_precio; aca solo se dice. Sin cambio, vacio: nunca "sin cambios",
  porque antes de que se empezara a guardar la historia no se sabe.
*/

function subioOBajo(cambio: CambioDePrecio): string {
  return `${cambio.pct > 0 ? "Subió" : "Bajó"} ${Math.round(Math.abs(cambio.pct))}%`;
}

/** Detalle del producto: "Bajó 10% el 25/11 (antes $ 4.000)". */
export function textoCambioDetalle(cambio: CambioDePrecio | null | undefined): string {
  if (!cambio) return "";
  return `${subioOBajo(cambio)} el ${fechaCorta(cambio.fecha)} (antes ${formatearPesos(cambio.precio_anterior)})`;
}

/** Tu lista: "Bajó 6% en Día el 25/11". */
export function textoCambioLista(cambio: CambioDePrecio | null | undefined, cadena: string): string {
  if (!cambio) return "";
  return `${subioOBajo(cambio)} en ${cadena} el ${fechaCorta(cambio.fecha)}`;
}

/** Verde la baja; la suba en el tono de aviso del sitio, no en rojo de error. */
export function claseCambio(cambio: CambioDePrecio): string {
  return cambio.pct > 0 ? "text-aviso" : "text-ahorro";
}
