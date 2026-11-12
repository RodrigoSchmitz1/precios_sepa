import type { PrecioEnCadena } from "../types";

/*
  Mismo producto con zona (openspec/changes/zona-compartida, spec mismo-producto).

  El precio de un producto es el de la cadena en todo el pais: no hay precio por
  sucursal de un codigo de barras. Lo que la zona agrega es cuales de esas
  cadenas tiene el usuario cerca. Como una cadena cobra casi lo mismo en todo
  el pais (medido el 2026-10-27, +-2 a 4%), "la mas barata de tu zona" es una
  respuesta honesta sin inventar precios locales.
*/
export function partirPorZona(precios: PrecioEnCadena[], cadenasZona: Set<string>) {
  return {
    enZona: precios.filter((p) => cadenasZona.has(p.cadena)),
    resto: precios.filter((p) => !cadenasZona.has(p.cadena)),
  };
}

export type ResumenZona =
  | { tipo: "ninguna" }
  | { tipo: "una"; cadena: string; precio: number }
  | { tipo: "varias"; baratas: string[]; precio: number; caras: string[]; precioCaro: number; ahorroPct: number };

/**
 * La mas barata de la zona y cuanto menos cobra que la mas cara de la zona.
 * Solo cuentan los precios creibles, como en la comparacion nacional: un
 * precio mal cargado no puede ganar ni perder.
 */
export function resumirZona(enZona: PrecioEnCadena[]): ResumenZona {
  const creibles = enZona.filter((p) => p.precio_creible);
  if (creibles.length === 0) return { tipo: "ninguna" };
  if (creibles.length === 1) return { tipo: "una", cadena: creibles[0].cadena, precio: creibles[0].precio_mediano };
  const minimo = Math.min(...creibles.map((p) => p.precio_mediano));
  const maximo = Math.max(...creibles.map((p) => p.precio_mediano));
  return {
    tipo: "varias",
    baratas: creibles.filter((p) => p.precio_mediano === minimo).map((p) => p.cadena),
    precio: minimo,
    caras: creibles.filter((p) => p.precio_mediano === maximo).map((p) => p.cadena),
    precioCaro: maximo,
    ahorroPct: Math.round((1 - minimo / maximo) * 100),
  };
}
