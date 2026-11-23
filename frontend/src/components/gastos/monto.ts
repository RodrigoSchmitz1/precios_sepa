/** Un monto escrito como en la Argentina: "43.900", "43900,50", "$ 1.234". */
export function leerMonto(texto: string): number | null {
  let limpio = texto.replace(/[$\s]/g, "");
  if (!limpio) return null;
  if (limpio.includes(",")) limpio = limpio.replace(/\./g, "").replace(",", ".");
  // "43.900" con punto de miles y sin coma: tres digitos despues del ultimo punto.
  else if (/^\d{1,3}(\.\d{3})+$/.test(limpio)) limpio = limpio.replace(/\./g, "");
  const valor = Number(limpio);
  return Number.isFinite(valor) && valor >= 0 ? Math.round(valor * 100) / 100 : null;
}
