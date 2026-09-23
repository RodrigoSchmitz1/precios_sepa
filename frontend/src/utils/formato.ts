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
export function fechaEnPalabras(iso: string | null | undefined): string {
  // Devuelve vacio si no hay fecha o no tiene la forma esperada: una version del
  // frontend puede quedar servida contra una API anterior que todavia no manda
  // el campo, y eso no puede tirar abajo la pagina entera.
  const partes = (iso ?? "").split("-");
  const mes = Number(partes[1]);
  const dia = Number(partes[2]);
  if (!Number.isInteger(dia) || !MESES[mes - 1]) return "";
  return `${dia} de ${MESES[mes - 1]}`;
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

/**
 * Tamano de un envase para leer: 1000 g -> "1 kg", 2250 cc -> "2,25 L",
 * 6 unidades -> "6 u". Devuelve null si no hay dato, para que quien lo usa no
 * muestre un "0 g" inventado.
 *
 * Existe porque SEPA manda muchas descripciones cortadas: "PLAYADITO YERBA CON"
 * es la descripcion completa de un paquete de 1 kg. El tamano sale de
 * cantidad_normalizada, que se calcula desde las columnas de presentacion y no
 * del texto.
 */
export function formatearTamano(
  cantidad: number | null | undefined,
  unidad: "g" | "cc" | "unidad" | null | undefined
): string | null {
  if (!cantidad || cantidad <= 0 || !unidad) return null;
  const numero = (valor: number) =>
    valor.toLocaleString("es-AR", { maximumFractionDigits: valor < 10 ? 2 : 0 });
  if (unidad === "g") return cantidad >= 1000 ? `${numero(cantidad / 1000)} kg` : `${numero(cantidad)} g`;
  if (unidad === "cc") return cantidad >= 1000 ? `${numero(cantidad / 1000)} L` : `${numero(cantidad)} ml`;
  return `${numero(cantidad)} u`;
}

/**
 * El tamano que le FALTA a una descripcion, o null si ya lo dice.
 *
 * "COCA COLA GASEOSA ZERO 2.25L" ya trae el tamano, y agregarle "(2,25 L)"
 * seria ruido. "PLAYADITO YERBA CON" no lo trae, y ahi es donde hace falta.
 * Se busca el numero como token suelto, en las dos escalas (2,25 y 2250), para
 * que "LECHE 1000CC" tampoco se duplique como "(1 L)".
 */
export function tamanoQueFalta(
  descripcion: string,
  cantidad: number | null | undefined,
  unidad: "g" | "cc" | "unidad" | null | undefined
): string | null {
  const tamano = formatearTamano(cantidad, unidad);
  if (!tamano || !cantidad) return null;
  const texto = descripcion.toLowerCase().split(",").join(".");
  const numeros = [cantidad, cantidad / 1000]
    .filter((v) => v >= 0.1)
    .map((v) => String(Number(v.toFixed(2))));
  const aparece = numeros.some((n) =>
    new RegExp("(^|[^0-9.])" + n.split(".").join("[.]") + "(?![0-9])").test(texto)
  );
  return aparece ? null : tamano;
}

