/*
  Las cantidades de Tu canasta en es-AR (openspec tu-canasta-confiable).

  El campo era type=number: Safari mostraba "20.86" con punto, contra la regla
  es-AR del sitio, y no todos los teclados dejan escribir coma ahi. Ahora es un
  campo de texto con teclado decimal; esto lo escribe y lo lee.
*/

/** "20,86": hasta 2 decimales, sin ceros de mas. */
export function mostrarCantidad(valor: number): string {
  if (!Number.isFinite(valor)) return "";
  const redondeado = Math.round(valor * 100) / 100;
  return String(redondeado).replace(".", ",");
}

/** Acepta "3,5" y "3.5". null si no es un numero mayor que cero. */
export function leerCantidad(texto: string): number | null {
  const limpio = texto.trim().replace(",", ".");
  if (!/^\d*\.?\d+$|^\d+\.$/.test(limpio)) return null;
  const valor = Number(limpio);
  return Number.isFinite(valor) && valor > 0 ? valor : null;
}
