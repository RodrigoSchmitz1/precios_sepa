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
