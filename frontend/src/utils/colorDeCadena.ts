/*
  El color del circulo con la inicial de cada cadena en Mis gastos (openspec
  mis-gastos-como-app). Es solo una inicial en un circulo, no un logo: las
  cadenas grandes tienen un color que se les parece y el resto sale de una
  paleta fija segun su nombre, asi la misma cadena tiene siempre el mismo.
*/
const CONOCIDAS: [RegExp, string][] = [
  [/carrefour|maxi|market|express/i, "#1d4fd8"],
  [/coto/i, "#c81e2b"],
  [/d[ií]a\b/i, "#e0312b"],
  [/jumbo/i, "#15803d"],
  [/disco/i, "#b91c1c"],
  [/vea/i, "#dc2626"],
  [/chango/i, "#0e7490"],
  [/an[oó]nima/i, "#1e40af"],
  [/toledo/i, "#b45309"],
  [/cooperativa|coope/i, "#0f766e"],
];

const PALETA = ["#5b3df5", "#0f8a63", "#c2601c", "#3e6fd0", "#a8437e", "#00a3ad", "#7c3aed", "#9a6b00"];

export function colorDeCadena(cadena: string): string {
  const conocida = CONOCIDAS.find(([patron]) => patron.test(cadena));
  if (conocida) return conocida[1];
  let hash = 0;
  for (const letra of cadena.toLowerCase()) hash = (hash * 31 + letra.charCodeAt(0)) >>> 0;
  return PALETA[hash % PALETA.length];
}

/** La inicial que va en el circulo. */
export function inicialDeCadena(cadena: string): string {
  return (cadena.trim()[0] ?? "?").toUpperCase();
}
