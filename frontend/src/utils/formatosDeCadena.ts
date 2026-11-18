import type { CambioDePrecio, PrecioEnCadena } from "../types";
import { listarConY } from "./texto";

/*
  Formatos de una misma cadena (openspec formatos-de-una-cadena, 2026-11-18).

  Changomás, SuperChangomás e HiperChangomás, o Carrefour, Market y Express,
  iban en filas separadas aunque cobraran lo mismo, y el titular decia
  "Changomás y 1 más". Se agrupan SOLO cuando el precio es exactamente el mismo:
  medido sobre 47.740 productos, las banderas de una empresa no cobran igual.
  Carrefour y Market coinciden en el 89%, pero Carrefour y Express en el 44% y
  Changomás y SuperChangomás en el 36%, con SuperChangomás 4% más barata.
  Juntar la empresa entera en una fila escondería esas diferencias.

  Afuera a propósito:
  - Maxi (Carrefour): otra lógica de precio, -5% de mediana contra Carrefour.
  - Vea, Disco y Jumbo: para la gente son súper distintos (Vea +4% vs Disco).
*/

/** De qué cadena es cada formato, con los nombres visibles y los de la API. */
export const FORMATO_DE: Record<string, string> = {
  Carrefour: "Carrefour",
  "Market (Carrefour)": "Carrefour",
  "Express (Carrefour)": "Carrefour",
  Changomás: "Changomás",
  SuperChangomás: "Changomás",
  HiperChangomás: "Changomás",
  Changomas: "Changomás",
  SuperChangomas: "Changomás",
  HiperChangomas: "Changomás",
};

/** Una fila del detalle: una bandera, o varios formatos de una cadena al mismo precio. */
export type FilaDePrecio = Omit<PrecioEnCadena, "cadena"> & { cadenas: string[]; cadena: string };

function mismoCambio(a: CambioDePrecio | null | undefined, b: CambioDePrecio | null | undefined): boolean {
  if (!a || !b) return !a && !b;
  return a.fecha === b.fecha && a.pct === b.pct && a.precio_anterior === b.precio_anterior;
}

/**
 * Junta los formatos de una cadena con el mismo precio (a centavos), la misma
 * marca de creíble y la misma fecha. Las sucursales se suman y el rango es el
 * de todo el grupo. El cambio de precio queda solo si es el mismo en todas:
 * no hay una frase honesta para "bajó en una de las dos". Conserva el orden.
 */
export function agruparFormatos(precios: PrecioEnCadena[]): FilaDePrecio[] {
  const filas: FilaDePrecio[] = [];
  const porClave = new Map<string, FilaDePrecio>();
  for (const p of precios) {
    const formato = FORMATO_DE[p.cadena];
    const clave = formato ? `${formato}|${Math.round(p.precio_mediano * 100)}|${p.precio_creible}|${p.fecha_precio ?? ""}` : null;
    const existente = clave ? porClave.get(clave) : undefined;
    if (existente) {
      existente.cadenas.push(p.cadena);
      existente.cadena = existente.cadenas.join(" · ");
      existente.sucursales += p.sucursales;
      existente.precio_minimo = Math.min(existente.precio_minimo, p.precio_minimo);
      existente.precio_maximo = Math.max(existente.precio_maximo, p.precio_maximo);
      if (!mismoCambio(existente.cambio, p.cambio)) existente.cambio = null;
      continue;
    }
    const fila: FilaDePrecio = { ...p, cadenas: [p.cadena], cadena: p.cadena };
    filas.push(fila);
    if (clave) porClave.set(clave, fila);
  }
  return filas;
}

const NOMBRADAS = 3;

/**
 * "Coto", "Changomás · HiperChangomás", "Coto, Día y Vea", "Coto, Día, Vea y
 * 2 más". Los formatos de una misma cadena que vienen en la lista se nombran
 * juntos, como una sola. Reemplaza al viejo "Coto y 2 más", que no decía cuáles.
 */
export function nombrarCadenas(nombres: string[]): string {
  const juntos: string[] = [];
  const posicion = new Map<string, number>();
  for (const nombre of nombres) {
    const formato = FORMATO_DE[nombre];
    if (formato && posicion.has(formato)) {
      juntos[posicion.get(formato)!] += ` · ${nombre}`;
      continue;
    }
    if (formato) posicion.set(formato, juntos.length);
    juntos.push(nombre);
  }
  if (juntos.length <= NOMBRADAS) return listarConY(juntos);
  return `${juntos.slice(0, NOMBRADAS).join(", ")} y ${juntos.length - NOMBRADAS} más`;
}
