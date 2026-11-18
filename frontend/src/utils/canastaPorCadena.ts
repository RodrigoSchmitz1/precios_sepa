import { nombreCategoria } from "./nombres";
import { listarConY } from "./texto";

/*
  Que suma "Tu canasta en cada super" (openspec tu-canasta-confiable).

  La seccion compara solo las categorias que venden TODAS las cadenas, para
  comparar parejo. Con la canasta del INDEC en Lomas (2026-11-18) eran 25 de
  32: afuera azucar, papa, verduras, frutas, pollo, pescado y huevos. El
  titular decia "En Maxi te sale unos $ 514.122" y el paso 4, que si las suma,
  "Carrefour $ 676.951": parecian la misma cuenta y no coincidian. Ahora el
  titular dice sobre cuantas categorias compara, y una linea visible dice cuales
  quedaron afuera y donde si se suman.
*/

/** Las que mas compra una familia o un jubilado van primero en la linea. */
const FRESCAS = ["Verduras", "Frutas", "Pollo", "Huevos", "Carne vacuna", "Pescado", "Papa y tuberculos"];
const NOMBRADAS = 4;

/** "En las 25 categorías que venden todas," o "Con toda tu canasta,". */
export function encabezadoComparacion(comparadas: number, total: number): string {
  if (comparadas >= total) return "Con toda tu canasta,";
  return comparadas === 1 ? "En la única categoría que venden todas," : `En las ${comparadas} categorías que venden todas,`;
}

/** La linea de lo que no entra, o vacio si entra todo. */
export function lineaCategoriasAfuera(afuera: string[]): string {
  if (afuera.length === 0) return "";
  const ordenadas = [...afuera].sort((a, b) => {
    const ia = FRESCAS.indexOf(a), ib = FRESCAS.indexOf(b);
    return (ia === -1 ? FRESCAS.length : ia) - (ib === -1 ? FRESCAS.length : ib);
  });
  const nombres = ordenadas.slice(0, NOMBRADAS).map(nombreCategoria);
  const resto = ordenadas.length - nombres.length;
  const lista = resto > 0 ? `${nombres.join(", ")} y ${resto} más` : listarConY(nombres);
  const conMinuscula = lista.charAt(0) + lista.slice(1).toLowerCase();
  const verbo = ordenadas.length === 1 ? "no entra acá porque no la venden" : "no entran acá porque no las venden";
  return `${conMinuscula} ${verbo} todas las cadenas. Abajo, en Dónde comprarla cerca tuyo, sí se suman, sucursal por sucursal.`;
}
