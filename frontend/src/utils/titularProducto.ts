import type { PrecioEnCadena, ProductoDetalle } from "../types";

/*
  El titular del detalle de un producto (openspec respuesta-antes-que-el-titular).

  Con zona, el titular decia "7% mas caro en Coto y 2 mas que en Vea" con Lomas
  de Zamora elegida, donde no hay Vea, y un recuadro verde mas abajo nombraba
  otra cadena como la mas barata de la zona. Ahora titular y tarjetas salen de
  la misma cuenta: la de la zona si hay zona y alguna cadena de la zona lo vende
  con precio creible, y la del pais si no.

  Y una diferencia chica se dice como chica: un 3% en rosa grande dramatizaba
  una no-noticia.
*/

/** Debajo de esto, "cuesta casi lo mismo". Es el escalon de las reglas de
 *  precios medidas el 2026-10-27 (Maxi, 5% debajo de Carrefour) y el orden de lo
 *  que varia una cadena entre provincias (+-2 a 4%): ruido de la mediana. */
export const DIFERENCIA_CASI_IGUAL_PCT = 5;

export type Extremos = {
  baratas: string[];
  precio: number;
  caras: string[];
  precioCaro: number;
  /** Cuanto mas cobra la mas cara que la mas barata, en %. */
  diferenciaPct: number;
  /** Cuanto menos cobra la mas barata que la mas cara, en % entero: "un 20% menos". */
  menosPct: number;
  cadenas: number;
};

export type TitularProducto =
  | { alcance: "zona"; tipo: "no_en_zona" | "sin_creible_en_zona"; cifras: Extremos }
  | { alcance: "zona"; tipo: "una_cadena"; cadena: string; precio: number; cifras: Extremos }
  | { alcance: "zona" | "pais"; tipo: "igual" | "casi_igual" | "diferencia"; cifras: Extremos }
  | { alcance: "pais"; tipo: "sin_respaldo"; cifras: Extremos };

/** Los extremos entre precios creibles; null si no hay ninguno. */
export function extremos(precios: PrecioEnCadena[]): Extremos | null {
  const creibles = precios.filter((p) => p.precio_creible);
  if (creibles.length === 0) return null;
  const precio = Math.min(...creibles.map((p) => p.precio_mediano));
  const precioCaro = Math.max(...creibles.map((p) => p.precio_mediano));
  return {
    baratas: creibles.filter((p) => p.precio_mediano === precio).map((p) => p.cadena),
    precio,
    caras: creibles.filter((p) => p.precio_mediano === precioCaro).map((p) => p.cadena),
    precioCaro,
    diferenciaPct: Math.round(((precioCaro - precio) / precio) * 1000) / 10,
    menosPct: Math.round(((precioCaro - precio) / precioCaro) * 100),
    cadenas: creibles.length,
  };
}

function porDiferencia(alcance: "zona" | "pais", e: Extremos): TitularProducto {
  if (e.precioCaro === e.precio) return { alcance, tipo: "igual", cifras: e };
  if (e.diferenciaPct < DIFERENCIA_CASI_IGUAL_PCT) return { alcance, tipo: "casi_igual", cifras: e };
  return { alcance, tipo: "diferencia", cifras: e };
}

/** Los extremos del pais, los mismos que publica el mart (y la portada). */
export function extremosDelPais(p: ProductoDetalle): Extremos {
  return {
    baratas: p.precios.filter((x) => x.precio_mediano === p.precio_mas_bajo).map((x) => x.cadena),
    precio: p.precio_mas_bajo,
    caras: p.precios.filter((x) => x.precio_mediano === p.precio_mas_alto).map((x) => x.cadena),
    precioCaro: p.precio_mas_alto,
    diferenciaPct: p.diferencia_pct,
    menosPct: p.precio_mas_alto > 0 ? Math.round(((p.precio_mas_alto - p.precio_mas_bajo) / p.precio_mas_alto) * 100) : 0,
    cadenas: p.cadenas,
  };
}

export function titularDelProducto(p: ProductoDetalle, cadenasZona: Set<string> | null): TitularProducto {
  const pais = extremosDelPais(p);
  if (cadenasZona) {
    const enZona = p.precios.filter((x) => cadenasZona.has(x.cadena));
    if (enZona.length === 0) return { alcance: "zona", tipo: "no_en_zona", cifras: pais };
    const zona = extremos(enZona);
    if (!zona) return { alcance: "zona", tipo: "sin_creible_en_zona", cifras: pais };
    if (zona.cadenas === 1) return { alcance: "zona", tipo: "una_cadena", cadena: zona.baratas[0], precio: zona.precio, cifras: zona };
    return porDiferencia("zona", zona);
  }
  // Sin zona, como el mart: la diferencia se publica solo si los extremos
  // estan respaldados por suficientes sucursales.
  if (pais.precioCaro > pais.precio && !p.extremos_respaldados) return { alcance: "pais", tipo: "sin_respaldo", cifras: pais };
  return porDiferencia("pais", pais);
}
