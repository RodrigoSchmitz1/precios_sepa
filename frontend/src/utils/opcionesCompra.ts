import type { OpcionCompra } from "../types";

/*
  Las opciones de "Dónde comprarla cerca tuyo" (arreglos-segundo-explore,
  2026-11-19).

  La página elegía el "Mejor total" por el monto más bajo, sin mirar cuántas
  categorías cubre cada opción. El explore vio "En 2 sucursales $ 146.661" más
  caro que "En una sucursal $ 144.427": la de una cubría 26 de 27 y la pantalla
  no lo decía, y "Contra una sola" restaba totales que no cubren lo mismo. La
  API ya ordena por cobertura y después por costo; acá se hace igual.
*/

/** La que cubre más categorías y, entre las que cubren lo mismo, la más barata. */
export function mejorOpcion(opciones: OpcionCompra[]): OpcionCompra | null {
  return opciones.reduce<OpcionCompra | null>((mejor, o) => {
    if (!mejor) return o;
    if (o.items_cubiertos !== mejor.items_cubiertos) return o.items_cubiertos > mejor.items_cubiertos ? o : mejor;
    return o.total < mejor.total ? o : mejor;
  }, null);
}

/** Contra qué se mide el ahorro de una opción: la de una sucursal, solo si
 *  cubre lo mismo. Si no, no hay una resta honesta. */
export function comparableConUnaSola(opcion: OpcionCompra, unaSola: OpcionCompra | null): boolean {
  return unaSola !== null && unaSola !== opcion && unaSola.items_cubiertos === opcion.items_cubiertos;
}

/** Las categorías que la opción no cubre, entre las que tienen precio en la zona. */
export function categoriasQueFaltan(opcion: OpcionCompra, conPrecio: string[]): string[] {
  const cubiertas = new Set(opcion.sucursales.flatMap((s) => s.items.map((i) => i.categoria)));
  return conPrecio.filter((c) => !cubiertas.has(c));
}
