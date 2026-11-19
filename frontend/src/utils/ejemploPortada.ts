import type { PrecioEnCadena } from "../types";

/*
  El producto de ejemplo de la portada (arreglos-segundo-explore, 2026-11-19).

  Con una zona elegida, la tarjeta de la Coca Cola seguia comparando todas las
  cadenas del país (Maxi, Coto, La Anónima) sin decirlo, contra el requisito
  "Lo nacional se dice como nacional". Ahora, con zona, compara las cadenas
  cerca si al menos dos venden el producto; si no, las del país, y lo dice.
*/

export type EjemploPortada = {
  /** La más barata, una del medio y la más cara. */
  filas: PrecioEnCadena[];
  /** Diferencia entre la más cara y la más barata de las filas, en %. */
  diferenciaPct: number;
  cadenas: number;
  deZona: boolean;
};

export function ejemploDePortada(precios: PrecioEnCadena[], cadenasZona: Set<string> | null): EjemploPortada | null {
  const creibles = precios.filter((p) => p.precio_creible).sort((a, b) => a.precio_mediano - b.precio_mediano);
  const cerca = cadenasZona ? creibles.filter((p) => cadenasZona.has(p.cadena)) : [];
  const deZona = cerca.length >= 2;
  const lista = deZona ? cerca : creibles;
  if (lista.length < 2) return null;
  const filas = lista.length >= 3 ? [lista[0], lista[Math.floor(lista.length / 2)], lista[lista.length - 1]] : lista;
  const barata = lista[0].precio_mediano;
  const cara = lista[lista.length - 1].precio_mediano;
  return { filas, diferenciaPct: ((cara - barata) / barata) * 100, cadenas: lista.length, deZona };
}
