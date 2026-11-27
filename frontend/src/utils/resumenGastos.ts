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

/* Mis gastos como app (openspec mis-gastos-como-app). */

export type TramoSemana = { etiqueta: string; total: number };

function diasDelMes(mes: string): number {
  const [anio, m] = mes.split("-").map(Number);
  // Dia 0 del mes siguiente = ultimo dia de este; en UTC no hay corrimiento.
  return new Date(Date.UTC(anio, m, 0)).getUTCDate();
}

/** Cinco tramos fijos del mes (1-7, 8-14, 15-21, 22-28 y 29 al fin); el ultimo no existe en un febrero de 28. */
export function semanasDelMes(gastos: Gasto[], mes: string): TramoSemana[] {
  const fin = diasDelMes(mes);
  const tramos: TramoSemana[] = [];
  for (let desde = 1; desde <= fin; desde += 7) {
    const hasta = desde === 29 || desde + 6 >= fin ? fin : desde + 6;
    const total = gastos
      .filter((g) => mesDe(g.fecha) === mes)
      .filter((g) => {
        const dia = Number(g.fecha.slice(8, 10));
        return dia >= desde && dia <= hasta;
      })
      .reduce((s, g) => s + g.total, 0);
    tramos.push({ etiqueta: desde === hasta ? `${desde}` : `${desde}–${hasta}`, total: Math.round(total * 100) / 100 });
    if (hasta === fin) break;
  }
  return tramos;
}

/** Cuantas compras hubo en cada super entre los gastos dados. */
export function comprasPorSuper(gastos: Gasto[]): Map<string, number> {
  const mapa = new Map<string, number>();
  for (const g of gastos) mapa.set(g.cadena, (mapa.get(g.cadena) ?? 0) + 1);
  return mapa;
}

/** El total sobre los dias que pasaron: hasta hoy en el mes en curso, el mes entero si ya termino. */
export function gastoPorDia(total: number, mes: string, hoy: string): number {
  const dias = mesDe(hoy) === mes ? Number(hoy.slice(8, 10)) : diasDelMes(mes);
  return dias > 0 ? Math.round((total / dias) * 100) / 100 : 0;
}

const DIAS_SEMANA = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
const MESES_CORTOS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

/** "Hoy · 26 nov", "Ayer · 25 nov" o "Jueves 20 nov": el encabezado de un dia en Movimientos. */
export function encabezadoDeDia(fecha: string, hoy: string): string {
  const [anio, mes, dia] = fecha.split("-").map(Number);
  const corto = `${dia} ${MESES_CORTOS[mes - 1]}`;
  if (fecha === hoy) return `Hoy · ${corto}`;
  const [ah, mh, dh] = hoy.split("-").map(Number);
  const diferencia = (Date.UTC(ah, mh - 1, dh) - Date.UTC(anio, mes - 1, dia)) / 86400000;
  if (diferencia === 1) return `Ayer · ${corto}`;
  return `${DIAS_SEMANA[new Date(Date.UTC(anio, mes - 1, dia)).getUTCDay()]} ${corto}`;
}

/** Los gastos agrupados por fecha, del dia mas nuevo al mas viejo (vienen ordenados de resumirMes). */
export function porDia(gastos: Gasto[]): { fecha: string; gastos: Gasto[] }[] {
  const grupos: { fecha: string; gastos: Gasto[] }[] = [];
  for (const g of gastos) {
    const ultimo = grupos.at(-1);
    if (ultimo && ultimo.fecha === g.fecha) ultimo.gastos.push(g);
    else grupos.push({ fecha: g.fecha, gastos: [g] });
  }
  return grupos;
}

/* ---------------------------------------------------------------------------
   Rubros y productos del mes (openspec app-para-el-usuario). Las categorias de
   SEPA son muy finas (Yerba mate, Galletitas dulces...) y "Otras" se llevaba el
   50% de la dona. El mapa categoria -> rubro lo manda la API (/gastos/estado),
   armado con la misma taxonomia que el resto del sitio.
--------------------------------------------------------------------------- */

/** Cuantos rubros se ven; el resto va a "Otros". */
export const RUBROS_VISIBLES = 7;
export const RUBRO_OTROS = "Otros";

export type MapaRubros = Record<string, string>;

/** El rubro de una categoria; sin dato, "Otros". "Sin detalle" queda aparte. */
export function rubroDe(categoria: string, rubros: MapaRubros): string {
  if (categoria === CATEGORIA_SIN_DETALLE) return CATEGORIA_SIN_DETALLE;
  return rubros[categoria] ?? RUBRO_OTROS;
}

/**
 * Lo gastado por rubro: los RUBROS_VISIBLES con mas gasto y el resto en "Otros",
 * con "Sin detalle" (gastos a mano) al final. Sin mapa de rubros, las categorias
 * como hasta ahora.
 */
export function porRubro(porCategoria: FilaResumen[], rubros: MapaRubros | null): FilaResumen[] {
  if (!rubros || Object.keys(rubros).length === 0) return porCategoria;
  const suma = new Map<string, number>();
  let sinDetalle = 0;
  for (const f of porCategoria) {
    const rubro = rubroDe(f.nombre, rubros);
    if (rubro === CATEGORIA_SIN_DETALLE) sinDetalle += f.total;
    else suma.set(rubro, (suma.get(rubro) ?? 0) + f.total);
  }
  const otrosAparte = suma.get(RUBRO_OTROS) ?? 0;
  suma.delete(RUBRO_OTROS);
  const orden = [...suma.entries()].sort((a, b) => b[1] - a[1]);
  const visibles = orden.slice(0, RUBROS_VISIBLES).map(([nombre, total]) => ({ nombre, total }));
  const otros = otrosAparte + orden.slice(RUBROS_VISIBLES).reduce((s, [, t]) => s + t, 0);
  return [
    ...visibles,
    ...(otros > 0.5 ? [{ nombre: RUBRO_OTROS, total: otros }] : []),
    ...(sinDetalle > 0.5 ? [{ nombre: CATEGORIA_SIN_DETALLE, total: sinDetalle }] : []),
  ];
}

export type ProductoDelMes = {
  clave: string;
  nombre: string;
  cantidad: number;
  total: number;
  cadenas: string[];
  rubro: string;
};

/**
 * Los productos del mes, de mayor a menor gasto. Las lineas con el mismo
 * producto de SEPA se suman como uno; las no vinculadas, por su descripcion. El
 * importe de cada linea se reparte los descuentos del ticket, igual que la dona.
 */
export function productosDelMes(gastos: Gasto[], rubros: MapaRubros): ProductoDelMes[] {
  const porClave = new Map<string, ProductoDelMes>();
  for (const g of gastos) {
    const bruto = g.lineas.reduce((s, l) => s + l.importe, 0);
    if (g.origen === "mano" || bruto <= 0) continue;
    const descuentos = g.descuentos.reduce((s, d) => s + d.importe, 0);
    const factor = Math.min(Math.max(bruto - descuentos, 0), g.total) / bruto;
    for (const l of g.lineas) {
      const clave = l.id_producto ?? `d:${l.descripcion.trim().toLowerCase()}`;
      const p = porClave.get(clave) ?? {
        clave,
        nombre: l.nombre ?? l.descripcion,
        cantidad: 0,
        total: 0,
        cadenas: [],
        rubro: rubroDe(l.categoria, rubros),
      };
      p.cantidad += l.cantidad;
      p.total += l.importe * factor;
      if (!p.cadenas.includes(g.cadena)) p.cadenas.push(g.cadena);
      porClave.set(clave, p);
    }
  }
  return [...porClave.values()].sort((a, b) => b.total - a.total);
}

/** Los productos de un rubro de la dona ("Otros" junta los rubros que no se ven). */
export function productosDeRubro(productos: ProductoDelMes[], rubro: string, visibles: string[]): ProductoDelMes[] {
  if (rubro === RUBRO_OTROS) return productos.filter((p) => !visibles.includes(p.rubro) || p.rubro === RUBRO_OTROS);
  return productos.filter((p) => p.rubro === rubro);
}
