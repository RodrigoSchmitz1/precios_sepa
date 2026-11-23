/*
  Resumen de Mis gastos por mes (openspec mis-gastos-y-barra-nueva). Los meses
  son "AAAA-MM" y se comparan como texto: nunca new Date("AAAA-MM-DD"), que en
  Argentina corre la fecha un dia.
*/
import type { Gasto } from "../types";
import { CATEGORIA_SIN_DETALLE } from "./gastos";

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
