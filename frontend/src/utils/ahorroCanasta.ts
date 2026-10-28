import type { CanastaPorCadena } from "../types";
import { formatearPesos } from "./formato";

/*
  La tarjeta "Cuanto ahorras eligiendo donde" de la portada.

  El total por cadena se suma solo sobre las categorias que venden todas las
  cadenas comparadas: el 2026-10-28 eran 25 de 32, sin verduras, frutas, pollo,
  pescado, huevos, papa ni azucar. El porcentaje es parejo, porque las dos
  cadenas se miden sobre lo mismo, pero el monto no es "la canasta basica" y la
  tarjeta lo decia asi. La pagina de Tu canasta lo aclaraba; la portada no.
  Ahora, si falta alguna categoria, el detalle dice cuantas entran.
*/
export function ahorroEnCadenas(canasta: CanastaPorCadena | undefined): { pct: number; detalle: string } | null {
  const cadenas = canasta?.cadenas ?? [];
  if (!canasta || cadenas.length < 2) return null;
  // Vienen ordenadas de la mas barata a la mas cara.
  const barata = cadenas[0];
  const cara = cadenas[cadenas.length - 1];
  const pct = Math.round((1 - barata.total / cara.total) * 100);
  if (pct <= 0) return null;

  const comparadas = canasta.categorias_comparadas.length;
  const queSeCompara =
    comparadas < canasta.total_categorias
      ? `${comparadas} de las ${canasta.total_categorias} categorías de la canasta básica`
      : "la canasta básica";
  return {
    pct,
    detalle: `${queSeCompara}: ${formatearPesos(barata.total)} en ${barata.cadena} y ${formatearPesos(cara.total)} en ${cara.cadena}`,
  };
}
