/*
  El mes de ejemplo de Mis gastos (openspec ejemplo-para-empezar): con cero
  gastos, la pagina muestra 7 tickets armados con los basicos reales (codigo de
  barras y precios de SEPA) para que se vea todo lo que da cargar tickets. Vive
  solo en memoria: nunca se guarda ni entra en el presupuesto, el Excel, la
  compra habitual, la racha ni las señales.
*/
import type { Basico, Gasto, LineaGasto } from "../types";

const CLAVE_DESCARTADO = "changuito.gastos.ejemplo.v1";
export const PREFIJO_EJEMPLO = "ejemplo-";
const CADENAS_SIN_ZONA = ["Carrefour", "Coto", "Día"];
const TICKETS = 7;
const PRODUCTOS_POR_TICKET = 6;
/** Donde cae el precio de cada cadena entre el mas bajo y el mas alto del pais:
 *  arriba de la mitad, como quien compra sin comparar, asi el ejemplo cuenta lo
 *  que muestra la pagina con tickets reales (cuanto salia en el mas barato). */
const POSICION_DE_PRECIO = [0.6, 0.75, 0.9];

export function ejemploDescartado(): boolean {
  try {
    return window.localStorage.getItem(CLAVE_DESCARTADO) === "hecho";
  } catch {
    return false;
  }
}

export function descartarEjemplo(): void {
  try {
    window.localStorage.setItem(CLAVE_DESCARTADO, "hecho");
  } catch {
    /* sin persistencia, el ejemplo vuelve en la proxima visita: no rompe nada */
  }
}

const redondear = (x: number) => Math.round(x * 100) / 100;

/** "AAAA-MM-DD" del mismo mes que hoy, unos dias antes (nunca antes del dia 1). */
function diaDelMes(hoy: string, diasAntes: number): string {
  const dia = Math.max(1, Number(hoy.slice(8, 10)) - diasAntes);
  return `${hoy.slice(0, 8)}${String(dia).padStart(2, "0")}`;
}

/**
 * Siete tickets del mes de hoy en hasta tres cadenas de la zona, con dos promos
 * de segunda unidad. Vacio si no hay basicos con precio.
 */
export function gastosDeEjemplo(basicos: Basico[], cadenasDeZona: string[], hoy: string): Gasto[] {
  const productos = basicos.filter((b) => b.producto.precio_mas_bajo > 0 && b.producto.precio_mas_alto >= b.producto.precio_mas_bajo);
  if (productos.length < PRODUCTOS_POR_TICKET) return [];
  const cadenas = (cadenasDeZona.length > 0 ? cadenasDeZona : CADENAS_SIN_ZONA).slice(0, 3);
  const gastos: Gasto[] = [];
  for (let t = 0; t < TICKETS; t++) {
    const nCadena = t % cadenas.length;
    const cadena = cadenas[nCadena];
    const posicion = POSICION_DE_PRECIO[nCadena % POSICION_DE_PRECIO.length];
    const lineas: LineaGasto[] = [];
    for (let k = 0; k < PRODUCTOS_POR_TICKET; k++) {
      const b = productos[(t * 5 + k * 7) % productos.length];
      if (lineas.some((l) => l.id_producto === b.producto.id_producto)) continue;
      const p = b.producto;
      const precio = redondear(p.precio_mas_bajo + (p.precio_mas_alto - p.precio_mas_bajo) * posicion);
      const cantidad = k === 0 && t % 3 === 1 ? 2 : 1;
      lineas.push({
        descripcion: p.descripcion,
        cantidad,
        precio_unitario: precio,
        importe: redondear(precio * cantidad),
        codigo: p.id_producto,
        id_producto: p.id_producto,
        nombre: p.descripcion,
        categoria: p.categoria ?? b.grupo,
        vinculo: "codigo",
      });
    }
    // Las promos de segunda unidad van en las lineas con dos unidades.
    const descuentos = lineas
      .filter((l) => l.cantidad === 2)
      .map((l) => ({ descripcion: `2da unidad 70% ${l.descripcion}`, importe: redondear(l.precio_unitario * 0.7) }));
    const bruto = lineas.reduce((s, l) => s + l.importe, 0);
    const total = redondear(bruto - descuentos.reduce((s, d) => s + d.importe, 0));
    gastos.push({
      id: `${PREFIJO_EJEMPLO}${t + 1}`,
      origen: "foto",
      cadena,
      cadenas_sepa: [cadena],
      sucursal: null,
      fecha: diaDelMes(hoy, t * 4),
      comprobante: null,
      total,
      lineas,
      descuentos,
      creado: TICKETS - t,
    });
  }
  return gastos;
}
