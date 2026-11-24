/*
  Resumen de Mis gastos por mes (openspec mis-gastos-y-barra-nueva). Los meses
  son "AAAA-MM" y se comparan como texto: nunca new Date("AAAA-MM-DD"), que en
  Argentina corre la fecha un dia.
*/
import type { Gasto } from "../types";
import { CATEGORIA_SIN_DETALLE } from "./gastos";
import { formatearPesos, mesEnPalabras, porcentajeEntero } from "./formato";

export type FilaResumen = { nombre: string; total: number };

export type ResumenMes = {
  mes: string;
  total: number;
  /** El total del mes anterior, o null si no hay gastos ese mes. */
  mesAnterior: number | null;
  /** Fraccion: 0,2 es un 20 % mas que el mes anterior. */
  variacion: number | null;
  porSuper: FilaResumen[];
  porCategoria: FilaResumen[];
  ahorroPromos: number;
  gastos: Gasto[];
};

export const mesDe = (fecha: string) => fecha.slice(0, 7);

export function mesAnteriorDe(mes: string): string {
  const [anio, m] = mes.split("-").map(Number);
  return m === 1 ? `${anio - 1}-12` : `${anio}-${String(m - 1).padStart(2, "0")}`;
}

/** Los meses con gastos, del mas nuevo al mas viejo. */
export function mesesConGastos(gastos: Gasto[]): string[] {
  return [...new Set(gastos.map((g) => mesDe(g.fecha)))].sort().reverse();
}

function ordenar(mapa: Map<string, number>): FilaResumen[] {
  return [...mapa.entries()]
    .map(([nombre, total]) => ({ nombre, total: Math.round(total * 100) / 100 }))
    .sort((a, b) => b.total - a.total || a.nombre.localeCompare(b.nombre));
}

/*
  Por categoria se reparte lo que se pago de verdad: cada linea suma su importe
  y los descuentos del ticket se restan en proporcion a cada categoria, asi la
  suma de las categorias da el total del ticket. Lo que no se explica con
  lineas (un ticket con lineas que faltan, o un gasto anotado a mano) va a
  "Sin detalle".
*/
function categoriasDeGasto(gasto: Gasto): Map<string, number> {
  const mapa = new Map<string, number>();
  const bruto = gasto.lineas.reduce((s, l) => s + l.importe, 0);
  if (gasto.origen === "mano" || bruto <= 0) {
    mapa.set(CATEGORIA_SIN_DETALLE, gasto.total);
    return mapa;
  }
  const descuentos = gasto.descuentos.reduce((s, d) => s + d.importe, 0);
  const pagadoPorLineas = Math.min(Math.max(bruto - descuentos, 0), gasto.total);
  const factor = pagadoPorLineas / bruto;
  for (const linea of gasto.lineas) {
    mapa.set(linea.categoria, (mapa.get(linea.categoria) ?? 0) + linea.importe * factor);
  }
  const resto = gasto.total - pagadoPorLineas;
  if (resto > 0.5) mapa.set(CATEGORIA_SIN_DETALLE, (mapa.get(CATEGORIA_SIN_DETALLE) ?? 0) + resto);
  return mapa;
}

export function resumirMes(gastos: Gasto[], mes: string): ResumenMes {
  const delMes = gastos
    .filter((g) => mesDe(g.fecha) === mes)
    .sort((a, b) => (b.fecha === a.fecha ? b.creado - a.creado : b.fecha.localeCompare(a.fecha)));
  const total = delMes.reduce((s, g) => s + g.total, 0);
  const anteriores = gastos.filter((g) => mesDe(g.fecha) === mesAnteriorDe(mes));
  const mesAnterior = anteriores.length > 0 ? anteriores.reduce((s, g) => s + g.total, 0) : null;

  const porSuper = new Map<string, number>();
  const porCategoria = new Map<string, number>();
  let ahorroPromos = 0;
  for (const g of delMes) {
    porSuper.set(g.cadena, (porSuper.get(g.cadena) ?? 0) + g.total);
    for (const [categoria, monto] of categoriasDeGasto(g)) {
      porCategoria.set(categoria, (porCategoria.get(categoria) ?? 0) + monto);
    }
    if (g.origen === "foto") ahorroPromos += g.descuentos.reduce((s, d) => s + d.importe, 0);
  }

  return {
    mes,
    total: Math.round(total * 100) / 100,
    mesAnterior,
    variacion: mesAnterior ? total / mesAnterior - 1 : null,
    porSuper: ordenar(porSuper),
    porCategoria: ordenar(porCategoria),
    ahorroPromos: Math.round(ahorroPromos * 100) / 100,
    gastos: delMes,
  };
}

/** El lunes (AAAA-MM-DD) de la semana de una fecha, en UTC para no correr el dia. */
function lunesDe(fecha: string): string {
  const [a, m, d] = fecha.split("-").map(Number);
  const dia = new Date(Date.UTC(a, m - 1, d));
  const desdeLunes = (dia.getUTCDay() + 6) % 7;
  dia.setUTCDate(dia.getUTCDate() - desdeLunes);
  return dia.toISOString().slice(0, 10);
}

function semanaAnterior(lunes: string): string {
  const [a, m, d] = lunes.split("-").map(Number);
  return new Date(Date.UTC(a, m - 1, d - 7)).toISOString().slice(0, 10);
}

/*
  Semanas seguidas (lunes a domingo) con al menos un gasto, terminando en la
  semana actual o en la anterior (openspec mis-gastos-para-volver). Si tuviera
  que terminar en la actual, se cortaria todos los lunes hasta cargar algo.
*/
export function rachaDeSemanas(gastos: Gasto[], hoy: string): number {
  const semanas = new Set(gastos.map((g) => lunesDe(g.fecha)));
  let lunes = lunesDe(hoy);
  if (!semanas.has(lunes)) lunes = semanaAnterior(lunes);
  let racha = 0;
  while (semanas.has(lunes)) {
    racha += 1;
    lunes = semanaAnterior(lunes);
  }
  return racha;
}

/*
  El texto de "Compartir" del resumen del mes (openspec mis-gastos-para-volver).
  Sale del mismo resumen que muestra la pantalla. No nombra supers ni
  sucursales: el resumen de alguien no tiene por que decir donde compra.
*/
export function textoInformeDelMes(resumen: ResumenMes, nombreDeCategoria: (c: string) => string = (c) => c): string {
  const [anio] = resumen.mes.split("-");
  const partes = [`En ${mesEnPalabras(`${resumen.mes}-01`)} ${anio} gasté ${formatearPesos(resumen.total)} en el súper`];
  if (resumen.variacion != null && Math.abs(resumen.variacion) >= 0.005) {
    partes.push(`${porcentajeEntero(Math.abs(resumen.variacion))} ${resumen.variacion > 0 ? "más" : "menos"} que el mes anterior`);
  }
  const principal = resumen.porCategoria.find((f) => f.nombre !== CATEGORIA_SIN_DETALLE);
  if (principal) partes.push(`donde más gasté fue ${nombreDeCategoria(principal.nombre)}`);
  if (resumen.ahorroPromos > 0) partes.push(`ahorré ${formatearPesos(resumen.ahorroPromos)} en promos`);
  return `${partes.join(", ")}. Lo llevo con Changuito.`;
}
