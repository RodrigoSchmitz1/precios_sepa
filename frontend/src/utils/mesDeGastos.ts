/*
  Tu mes en la cadena mas barata de tu zona, y mezclando dos (openspec
  promos-navegables-y-mes-en-gastos).

  Junta los productos vinculados de los tickets del mes y los cotiza con
  /mismo-producto/lista/donde-comprar, la misma cuenta de "Donde comprarla" en
  Mi compra: 1 y 2 sucursales cerca, con el precio de cada cadena.

  Precio de lista contra precio de lista, como la comparacion de cada ticket
  (comparacionTicket.ts): lo que figura en el ticket para esos productos antes
  de los descuentos. Comparar lo pagado con promos contra precios de lista
  haria parecer cara una compra hecha con descuento.
*/
import type { Gasto, OpcionDondeComprar, ResultadoDondeComprar } from "../types";
import { MAXIMO_PRODUCTOS } from "./lista";
import { mesDe } from "./resumenGastos";

export type ProductosDelMes = {
  items: { id_producto: string; cantidad: number }[];
  /** Lo que figura en los tickets para cada producto usado, antes de descuentos. */
  importes: Record<string, number>;
  /** Todas las lineas de los tickets del mes con foto, vinculadas o no. */
  bruto: number;
  /** Productos que quedaron afuera por el tope de una lista. */
  recortados: number;
  /** Por ticket del mes, los nombres de su cadena (el del ticket y los de SEPA). */
  cadenasPorTicket: string[][];
};

export function productosDelMes(gastos: Gasto[], mes: string): ProductosDelMes {
  const tickets = gastos.filter((g) => g.origen === "foto" && mesDe(g.fecha) === mes);
  let bruto = 0;
  const porProducto = new Map<string, { cantidad: number; importe: number }>();
  for (const g of tickets) {
    for (const l of g.lineas) {
      if (l.importe <= 0) continue;
      bruto += l.importe;
      if (!l.id_producto) continue;
      const previo = porProducto.get(l.id_producto) ?? { cantidad: 0, importe: 0 };
      porProducto.set(l.id_producto, {
        cantidad: previo.cantidad + Math.max(1, Math.round(l.cantidad)),
        importe: previo.importe + l.importe,
      });
    }
  }
  // Con mas productos que el tope de una lista, entran los de mayor importe.
  const ordenados = [...porProducto.entries()].sort((a, b) => b[1].importe - a[1].importe);
  const usados = ordenados.slice(0, MAXIMO_PRODUCTOS);
  return {
    items: usados.map(([id_producto, v]) => ({ id_producto, cantidad: Math.min(v.cantidad, 99) })),
    importes: Object.fromEntries(usados.map(([id, v]) => [id, Math.round(v.importe * 100) / 100])),
    bruto: Math.round(bruto * 100) / 100,
    recortados: ordenados.length - usados.length,
    cadenasPorTicket: tickets.map((g) => [g.cadena, ...g.cadenas_sepa]),
  };
}

export type ParteMezcla = { cadena: string; productos: string[]; subtotal: number };

export type ComparacionMes =
  | { estado: "sin-tickets" }
  | { estado: "poca-cobertura"; cobertura: number }
  | { estado: "sin-cadena" }
  | {
      estado: "ok";
      cadena: string;
      total: number;
      /** Lo que figura en los tickets para esos mismos productos. */
      pagado: number;
      productos: number;
      productosDelMes: number;
      yaEsLaMasBarata: boolean;
      mezcla: { total: number; ahorroContraUna: number; partes: ParteMezcla[] } | null;
    };

const normal = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

function cubiertos(opcion: OpcionDondeComprar): Set<string> {
  return new Set(opcion.sucursales.flatMap((s) => s.productos.map((p) => p.id_producto)));
}

function redondear(x: number): number {
  return Math.round(x * 100) / 100;
}

export function compararMes(
  datos: ProductosDelMes,
  resultado: ResultadoDondeComprar | null,
  coberturaMinima: number,
): ComparacionMes {
  if (datos.bruto <= 0) return { estado: "sin-tickets" };
  const vinculado = Object.values(datos.importes).reduce((s, x) => s + x, 0);
  if (datos.items.length === 0 || vinculado / datos.bruto < coberturaMinima) {
    return { estado: "poca-cobertura", cobertura: vinculado / datos.bruto };
  }
  const una = resultado?.opciones.find((o) => o.max_sucursales === 1 && o.sucursales.length === 1);
  if (!una) return { estado: "sin-cadena" };

  // La cuenta va sobre los productos que esa cadena consigue cerca: lo pagado
  // por esos mismos productos, y la cobertura contra todo lo del mes.
  const ids = cubiertos(una);
  const pagado = [...ids].reduce((s, id) => s + (datos.importes[id] ?? 0), 0);
  if (pagado / datos.bruto < coberturaMinima) return { estado: "poca-cobertura", cobertura: pagado / datos.bruto };

  const cadena = una.sucursales[0].cadena;
  // Todos los tickets del mes son de la mas barata: no hay diferencia que mostrar.
  const yaEsLaMasBarata = datos.cadenasPorTicket.every((nombres) => nombres.some((n) => normal(n) === normal(cadena)));

  // Mezclar dos se compara sobre los mismos productos que una sola, y solo si
  // de verdad son dos cadenas distintas y baja el total.
  const dos = resultado?.opciones.find((o) => o.max_sucursales === 2);
  let mezcla: Extract<ComparacionMes, { estado: "ok" }>["mezcla"] = null;
  if (dos) {
    const idsDos = cubiertos(dos);
    const mismos = idsDos.size === ids.size && [...ids].every((id) => idsDos.has(id));
    const cadenas = new Set(dos.sucursales.map((s) => normal(s.cadena)));
    if (mismos && cadenas.size === 2 && dos.total < una.total - 0.5) {
      mezcla = {
        total: dos.total,
        ahorroContraUna: redondear(una.total - dos.total),
        partes: dos.sucursales.map((s) => ({ cadena: s.cadena, productos: s.productos.map((p) => p.descripcion), subtotal: s.subtotal })),
      };
    }
  }

  return {
    estado: "ok",
    cadena,
    total: una.total,
    pagado: redondear(pagado),
    productos: ids.size,
    productosDelMes: datos.items.length + datos.recortados,
    yaEsLaMasBarata,
    mezcla,
  };
}
