/*
  Formateo de importes, centralizado para que todas las pantallas muestren los
  precios igual. Antes las promos imprimian `${precio}` crudo y salia "$184990".
*/

const FORMATO_PESOS = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 0,
});

export function formatearPesos(valor: number): string {
  return FORMATO_PESOS.format(valor);
}

const FORMATO_NUMERO = new Intl.NumberFormat("es-AR");

export function formatearNumero(valor: number): string {
  return FORMATO_NUMERO.format(valor);
}

const MESES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

/** "2026-09-07" -> "7 de septiembre". Se parsea a mano y no con new Date():
 *  new Date("2026-09-07") interpreta UTC y en Argentina (UTC-3) devuelve el 6. */
export function fechaEnPalabras(iso: string): string {
  const [, mes, dia] = iso.split("-");
  return `${Number(dia)} de ${MESES[Number(mes) - 1]}`;
}

/*
  Porcentaje de variacion con signo explicito y coma decimal.

  El signo va siempre, incluido el "+", porque es la mitad del dato: sin el, un
  "0,3%" en una lista donde conviven subas y bajas no dice nada. El "+0,00%" se
  normaliza a "0,00%": un cero con signo sugiere una direccion que no existe.
*/
export function formatearVariacion(valor: number, decimales = 2): string {
  const texto = Math.abs(valor).toLocaleString("es-AR", {
    minimumFractionDigits: decimales,
    maximumFractionDigits: decimales,
  });
  if (Number(valor.toFixed(decimales)) === 0) return `${texto}%`;
  return `${valor > 0 ? "+" : "−"}${texto}%`;
}

/*
  Precio por unidad, llevado a la unidad en la que la gente piensa.

  La fuente normaliza a gramo y centimetro cubico, asi que el nivel de precios
  de una categoria a granel sale en centavos por gramo: la fruta aparecia como
  "$3" y la yerba como "$13". Con cero decimales, ademas, $3,49 y $2,51 se
  imprimian los dos como "$3" y dos cadenas con 39% de diferencia se veian
  iguales. Multiplicar por mil y decir "por kg" no cambia el dato, lo hace
  legible: $3.490 y $2.510 por kilo.

  "unidad" se deja como esta: ahi el numero ya es el precio de un articulo.
*/
const EQUIVALENCIAS: Record<string, { factor: number; etiqueta: string }> = {
  g: { factor: 1000, etiqueta: "kg" },
  cc: { factor: 1000, etiqueta: "L" },
};

export function precioPorUnidad(
  valor: number,
  unidad: string
): { texto: string; unidad: string } {
  const eq = EQUIVALENCIAS[unidad];
  if (!eq) return { texto: formatearPesos(valor), unidad };
  return { texto: formatearPesos(valor * eq.factor), unidad: eq.etiqueta };
}
