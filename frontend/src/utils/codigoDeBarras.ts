/*
  Resolver un codigo de barras escaneado (openspec app-para-el-usuario). El id
  de cada producto es su EAN, asi que alcanza con pedir el producto. Pero el
  mismo producto puede llegar escrito de otra forma: un UPC-A de 12 digitos es
  el EAN-13 con un 0 adelante, y Coto informa sus codigos con un 0 de mas. Por
  eso se prueban, en orden, el codigo tal cual, con un 0 adelante y sin los
  ceros de adelante.
*/
import type { ProductoDetalle } from "../types";

/** Los formatos que se leen: los de los productos de supermercado. */
export const FORMATOS_DE_CODIGO = ["ean_13", "ean_8", "upc_a", "upc_e"] as const;

/** Solo digitos y un largo de codigo de producto (8 a 14). */
export function codigoValido(texto: string): string | null {
  const limpio = texto.replace(/\D/g, "");
  return limpio.length >= 8 && limpio.length <= 14 ? limpio : null;
}

export function codigosAProbar(codigo: string): string[] {
  const sinCeros = codigo.replace(/^0+/, "");
  return [...new Set([codigo, `0${codigo}`, sinCeros].filter((c) => c.length >= 8 && c.length <= 14))];
}

/** El producto del codigo, o null si no esta en los precios de SEPA. */
export async function resolverCodigo(
  codigo: string,
  obtener: (id: string) => Promise<ProductoDetalle>
): Promise<ProductoDetalle | null> {
  for (const candidato of codigosAProbar(codigo)) {
    try {
      return await obtener(candidato);
    } catch {
      /* no esta con esta forma: se prueba la siguiente */
    }
  }
  return null;
}
