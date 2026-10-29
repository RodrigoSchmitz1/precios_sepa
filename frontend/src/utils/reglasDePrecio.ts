import type { ReglaDePrecio } from "../types";

/*
  Como se presentan los escalones de una regla de precio ("un 5% menos").

  Auditoria 2026-10-28: el texto decia "casi siempre un 5% o 10% menos" aunque
  los escalones listados cubrieran poco mas de la mitad de las veces que la
  bandera es mas barata (Maxi: 34 de 58 puntos). "Casi siempre" se dice solo si
  cubren al menos el 80%; si no, "sobre todo".
*/

/** Los escalones que vale la pena nombrar: al menos el 1% de los productos. */
export function escalonesVisibles(r: ReglaDePrecio) {
  return r.escalones.filter((e) => e.pct_productos >= 1);
}

export function conectorEscalones(r: ReglaDePrecio): "casi siempre" | "sobre todo" | null {
  const escalones = escalonesVisibles(r);
  if (escalones.length === 0 || r.pct_mas_barata <= 0) return null;
  const cubierto = escalones.reduce((s, e) => s + e.pct_productos, 0);
  return cubierto >= 0.8 * r.pct_mas_barata ? "casi siempre" : "sobre todo";
}
