import type { ResultadoLista, TotalCadenaLista } from "../types";
import { DIFERENCIA_CASI_IGUAL_PCT } from "./titularProducto";

/*
  Tu lista con zona (openspec/changes/lista-en-tu-zona, spec mismo-producto).

  Con Lomas de Zamora elegida, Tu lista decia "ahorras 11%" contra la
  Cooperativa Obrera, que no tiene sucursal ahi. Con zona, el titular y "Con
  todos tus productos" salen del bloque "zona" de la API, que cuenta solo las
  cadenas de la zona. Las del resto del pais van aparte, sin ahorro.
*/

export type VistaLista = {
  /** "pais": sin zona, o con zona pero sin ningun producto que se consiga ahi. */
  alcance: "pais" | "zona";
  /** Con zona elegida y ningun producto de la lista vendido en ella. */
  nadaEnZona: boolean;
  completas: TotalCadenaLista[];
  incompletas: TotalCadenaLista[];
  combinando: number;
  /** Con zona: las cadenas sin sucursal en la zona, del resultado nacional. */
  otras: TotalCadenaLista[];
  /** Con zona: los productos que no vende ninguna cadena de la zona. */
  noEnZona: string[];
};

/**
 * Que comparar en Tu lista. `cadenasZona` son los nombres como se muestran
 * (cadenasVisibles), los mismos que trae el resultado.
 */
export function vistaDeLista(r: ResultadoLista, cadenasZona: Set<string> | null): VistaLista {
  const nacional = {
    completas: r.cadenas.filter((c) => c.completa),
    incompletas: r.cadenas.filter((c) => !c.completa),
    combinando: r.combinando_cadenas,
  };
  const zona = r.zona;
  if (!cadenasZona || !zona || r.productos.length === 0) {
    return { alcance: "pais", nadaEnZona: false, ...nacional, otras: [], noEnZona: [] };
  }
  if (zona.cadenas.length === 0) {
    return { alcance: "pais", nadaEnZona: true, ...nacional, otras: [], noEnZona: zona.no_en_zona };
  }
  return {
    alcance: "zona",
    nadaEnZona: false,
    completas: zona.cadenas.filter((c) => c.completa),
    incompletas: zona.cadenas.filter((c) => !c.completa),
    combinando: zona.combinando_cadenas,
    otras: r.cadenas.filter((c) => !cadenasZona.has(c.cadena)),
    noEnZona: zona.no_en_zona,
  };
}

/** Cuantos productos entran en la comparacion: con zona, los que se consiguen ahi. */
export function productosComparados(r: ResultadoLista, vista: VistaLista): number {
  return vista.alcance === "zona" ? r.productos.length - vista.noEnZona.length : r.productos.length;
}

/**
 * Como titular la comparacion entre la mas barata y la mas cara de la lista
 * (openspec lista-casi-lo-mismo). Debajo del 5% es "casi lo mismo", con el
 * mismo umbral que el detalle del producto: "ahorras $ 212 (2%)" en verde
 * presentaba como ahorro una diferencia que esta en el ruido de la mediana.
 */
export function comparacionDeLista(
  barata: TotalCadenaLista | undefined,
  cara: TotalCadenaLista | undefined
): "sin_comparacion" | "casi_igual" | "ahorro" {
  if (!barata || !cara || barata === cara || cara.total <= barata.total) return "sin_comparacion";
  return ((cara.total - barata.total) / barata.total) * 100 < DIFERENCIA_CASI_IGUAL_PCT ? "casi_igual" : "ahorro";
}
