import type { QuienGana } from "../types";

/*
  Formatos mayoristas (2026-09-26). Maxi, el mayorista de Carrefour, gana la
  mayoria de las categorias: es cierto, pero para quien hace la compra del mes
  en un super comun la pregunta es quien gana sin ellos (le queda mas cerca, no
  compra por bulto). Es una lista y no una regla porque SEPA no marca el
  formato. Vive aca y no en una pagina: la usan la portada, Mas barato y las
  comparaciones de precios por cadena, y tienen que decir lo mismo.
*/
export const MAYORISTAS = new Map([["Maxi (Carrefour)", "Maxi es el mayorista de Carrefour"]]);

export function esMayorista(cadena: string): boolean {
  return MAYORISTAS.has(cadena);
}

/** La cadena mas barata en mas categorias, y en cuantas. */
export function liderEn(filas: QuienGana[], categorias: string[]): [string, number] | undefined {
  const liderazgos = new Map<string, number>();
  for (const categoria of categorias) {
    const deLaCategoria = filas.filter((f) => f.categoria === categoria);
    if (deLaCategoria.length === 0) continue;
    const maximo = Math.max(...deLaCategoria.map((f) => f.pct_gana_cuando_compite));
    // Un empate en el tope cuenta para las dos: forzar un desempate seria
    // inventar una diferencia que los datos no tienen.
    for (const fila of deLaCategoria) {
      if (fila.pct_gana_cuando_compite === maximo) {
        liderazgos.set(fila.cadena, (liderazgos.get(fila.cadena) ?? 0) + 1);
      }
    }
  }
  return [...liderazgos.entries()].sort((a, b) => b[1] - a[1])[0];
}
