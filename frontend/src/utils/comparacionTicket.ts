/*
  "En la cadena mas barata de tu zona hubieras pagado..." (openspec
  mis-gastos-y-barra-nueva).

  Precio de lista contra precio de lista: las lineas vinculadas del ticket tal
  como figuran, antes de los descuentos, contra lo que cobra cada cadena de la
  zona por esos mismos productos (precio por cadena para todo el pais, el de
  Tu lista). Comparar lo pagado con promos contra precios de lista haria
  parecer cara una compra hecha con descuento.
*/
import type { Gasto, ResultadoLista } from "../types";
import { MAXIMO_PRODUCTOS } from "./lista";

export type ItemsDelTicket = {
  items: { id_producto: string; cantidad: number }[];
  /** Lo que figura en el ticket para esos productos, antes de descuentos. */
  pagado: number;
  /** Fraccion del importe de las lineas que esta vinculada a un producto. */
  cobertura: number;
  /** Productos que quedaron afuera por el tope de la cotizacion. */
  recortados: number;
};

export function itemsDelTicket(gasto: Gasto): ItemsDelTicket {
  const bruto = gasto.lineas.reduce((s, l) => s + l.importe, 0);
  const porProducto = new Map<string, { cantidad: number; importe: number }>();
  for (const l of gasto.lineas) {
    if (!l.id_producto || l.importe <= 0) continue;
    const previo = porProducto.get(l.id_producto) ?? { cantidad: 0, importe: 0 };
    porProducto.set(l.id_producto, {
      cantidad: previo.cantidad + Math.max(1, Math.round(l.cantidad)),
      importe: previo.importe + l.importe,
    });
  }
  // Con mas productos que el tope de la cotizacion, entran los de mayor importe.
  const ordenados = [...porProducto.entries()].sort((a, b) => b[1].importe - a[1].importe);
  const usados = ordenados.slice(0, MAXIMO_PRODUCTOS);
  const pagado = usados.reduce((s, [, v]) => s + v.importe, 0);
  return {
    items: usados.map(([id_producto, v]) => ({ id_producto, cantidad: Math.min(v.cantidad, 99) })),
    pagado: Math.round(pagado * 100) / 100,
    cobertura: bruto > 0 ? pagado / bruto : 0,
    recortados: ordenados.length - usados.length,
  };
}

export type Comparacion =
  | { estado: "sin-zona" }
  | { estado: "poca-cobertura"; cobertura: number }
  | { estado: "sin-cadena-completa" }
  | { estado: "ok"; pagado: number; cadena: string; total: number; diferencia: number; esLaMisma: boolean };

/** La cadena de la zona mas barata que tiene TODOS los productos vinculados. */
export function compararTicket(
  gasto: Gasto,
  datos: ItemsDelTicket,
  cotizacion: ResultadoLista | null,
  coberturaMinima: number,
): Comparacion {
  if (datos.cobertura < coberturaMinima || datos.items.length === 0) {
    return { estado: "poca-cobertura", cobertura: datos.cobertura };
  }
  if (!cotizacion?.zona) return { estado: "sin-zona" };
  const completas = cotizacion.zona.cadenas.filter(
    (c) => c.completa && c.productos_con_precio === datos.items.length,
  );
  if (completas.length === 0) return { estado: "sin-cadena-completa" };
  const masBarata = completas.reduce((a, b) => (b.total < a.total ? b : a));
  const normal = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  return {
    estado: "ok",
    pagado: datos.pagado,
    cadena: masBarata.cadena,
    total: masBarata.total,
    diferencia: Math.round((datos.pagado - masBarata.total) * 100) / 100,
    esLaMisma: gasto.cadenas_sepa.some((c) => normal(c) === normal(masBarata.cadena)) || normal(gasto.cadena) === normal(masBarata.cadena),
  };
}
