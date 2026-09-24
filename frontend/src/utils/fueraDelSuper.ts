/*
  Lo que mucha gente compra fuera del supermercado.

  SEPA solo informa supermercados. Quien compra la carne en la carniceria y la
  verdura en la verduleria igual compra en el super la yerba, las galletitas,
  el queso o la limpieza: esas categorias se apartan de la canasta (no se
  cotizan ni se suman) sin borrarse, y vuelven al desmarcar.

  Las mismas categorias que la regla 7 del prompt de api/interpretar_canasta.py,
  que las saca cuando la persona lo cuenta en la descripcion.
*/
export const LUGARES_DE_COMPRA = {
  carniceria: {
    etiqueta: "La carne, en la carniceria",
    lugar: "la carniceria",
    categorias: ["Carne vacuna", "Pollo", "Cerdo", "Achuras y menudencias"],
  },
  verduleria: {
    etiqueta: "La fruta y la verdura, en la verduleria",
    lugar: "la verduleria",
    categorias: ["Frutas", "Verduras", "Papa y tuberculos"],
  },
} as const;

export type LugarDeCompra = keyof typeof LUGARES_DE_COMPRA;

export function esLugarDeCompra(valor: unknown): valor is LugarDeCompra {
  return typeof valor === "string" && valor in LUGARES_DE_COMPRA;
}

/** Categorias que no se compran en el super, segun los lugares marcados. */
export function categoriasFueraDelSuper(lugares: readonly LugarDeCompra[]): Set<string> {
  return new Set(lugares.flatMap((l) => [...LUGARES_DE_COMPRA[l].categorias]));
}
