import type { QuienGana } from "../types";

/*
  Quien gana mas categorias. Vive aca y no en una pagina: la usan la portada y
  Mas barato, y tienen que decir lo mismo. Todas las cadenas compiten igual
  (2026-10-20): ya no se separa a Maxi como mayorista (ver CanastaPorCadena).
*/
/** En cuantas categorias cada cadena tiene el mejor porcentaje. La portada
 *  dibuja con esto su grafico de lideres; antes lo contaba aparte, con una
 *  regla que no contaba los empates (auditoria 2026-10-28). */
export function categoriasGanadas(filas: QuienGana[], categorias: string[]): Map<string, number> {
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
  return liderazgos;
}

/** La cadena mas barata en mas categorias, y en cuantas. */
export function liderEn(filas: QuienGana[], categorias: string[]): [string, number] | undefined {
  return [...categoriasGanadas(filas, categorias).entries()].sort((a, b) => b[1] - a[1])[0];
}
