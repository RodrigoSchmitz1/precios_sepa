import type { PromoCerca } from "../types";
import { fechaCorta, formatearPesos } from "./formato";

/*
  Las promos de tus productos cerca de tu zona (openspec promos-de-tu-lista).

  La API trae las promos vigentes a menos de 3 km del centro de la zona; aca
  se decide cuales valen la pena. La usan Tu lista y el detalle del producto,
  para que las dos digan lo mismo.
*/

/**
 * Las promos que dejan el producto mas barato que la cadena mas barata de la
 * zona. Una promo de 15% en Carrefour que igual sale mas que en Maxi no es una
 * razon para cambiar de super. Sin precio de la zona (ninguna cadena de la
 * zona vende el producto) cualquier promo cercana sirve.
 */
export function promosQueConvienen(promos: PromoCerca[] | undefined, precioZona: number | null | undefined): PromoCerca[] {
  if (!promos) return [];
  if (precioZona == null) return promos;
  return promos.filter((p) => p.precio_promo < precioZona);
}

/** "hasta el 23/11", o vacio si la cadena no dice hasta cuando vale. */
export function textoVigencia(promo: Pick<PromoCerca, "vigente_hasta">): string {
  const fecha = fechaCorta(promo.vigente_hasta);
  return fecha ? `hasta el ${fecha}` : "";
}

const MINUSCULAS = new Set(["de", "del", "la", "las", "los", "el", "y"]);

/** Algunas cadenas cargan la direccion en mayusculas ("CL THAMES 2447",
 *  "PALERMO"): se pasa a "Cl Thames 2447". Lo que ya viene escrito con
 *  mayusculas y minusculas se deja como esta, y una sigla sola ("CABA") tambien. */
function sinGritar(texto: string): string {
  if (texto !== texto.toUpperCase() || texto === texto.toLowerCase()) return texto;
  if (!texto.includes(" ") && texto.length <= 4) return texto;
  return texto
    .toLowerCase()
    .split(" ")
    .map((palabra, i) => (i > 0 && MINUSCULAS.has(palabra) ? palabra : palabra.charAt(0).toUpperCase() + palabra.slice(1)))
    .join(" ");
}

/** "Av. Santa Fe 3253 · Palermo", con la cadena aparte. */
export function direccionPromo(promo: Pick<PromoCerca, "calle" | "numero" | "nombre_sucursal" | "barrio" | "localidad">): string {
  const calle = [promo.calle, promo.numero].filter(Boolean).join(" ").trim();
  return [calle || promo.nombre_sucursal, promo.barrio || promo.localidad]
    .filter(Boolean)
    .map((parte) => sinGritar(parte as string))
    .join(" · ");
}

/** "y en 3 sucursales más cerca", o vacio. */
export function textoOtrasSucursales(promo: Pick<PromoCerca, "otras_sucursales_cerca">): string {
  const n = promo.otras_sucursales_cerca;
  if (n <= 0) return "";
  return n === 1 ? "y en 1 sucursal más cerca" : `y en ${n} sucursales más cerca`;
}

/** La linea de arriba de Tu lista. Vacia con cero: "0 productos en promo"
 *  sonaria a que no hay ofertas, cuando lo que pasa es que la cadena no las informa. */
export function resumenPromosDeLista(productosEnPromo: number): string {
  if (productosEnPromo <= 0) return "";
  return productosEnPromo === 1
    ? "Esta semana 1 producto de tu lista está en promo cerca tuyo"
    : `Esta semana ${productosEnPromo} productos de tu lista están en promo cerca tuyo`;
}

/**
 * La linea bajo el titular del detalle cuando una promo cerca deja el producto
 * por debajo del precio mas bajo de la zona (total-con-promos-cerca). El caso:
 * en Tres Arroyos el titular decia Vea a $ 4.890 y la Cooperativa Obrera de
 * Colon lo tenia en promo a $ 4.080. El titular de precio de lista no cambia.
 * Las de compra multiple no cuentan: el titular habla de una unidad.
 */
export function avisoPromoEnTitular(promos: PromoCerca[] | null | undefined, precioZona: number | null | undefined): string {
  // Sin promos de mayoristas: el titular es entre super (openspec sumar-mayoristas).
  const [mejor] = promosQueConvienen((promos ?? []).filter((p) => !p.requiere_compra_multiple && !p.mayorista), precioZona);
  if (!mejor || precioZona == null) return "";
  const vigencia = textoVigencia(mejor);
  return `Con promo: ${formatearPesos(mejor.precio_promo)} en ${mejor.cadena} (${direccionPromo(mejor)})${vigencia ? `, ${vigencia}` : ""}`;
}
