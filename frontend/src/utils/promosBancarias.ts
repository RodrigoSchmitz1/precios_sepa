/*
  Promos de bancos y billeteras (openspec promos-bancarias): que promos valen
  hoy en las cadenas de tu zona y cuanto pagas con cada una. Todo en un solo
  lugar: la portada, Mis tarjetas y "Con que pagar" leen de aca.

  Dos cifras siempre separadas, como recomienda el informe de Convi: lo que
  pagas en caja y lo que te devuelven despues. Sumarlas mentiria sobre lo que
  sale del bolsillo ese dia. El tope se toma entero (no sabemos cuanto usaste)
  y se aclara.
*/
import type { PromoBancaria } from "../types";

export const DIAS_SEMANA = ["domingo", "lunes", "martes", "miercoles", "jueves", "viernes", "sabado"] as const;
export type DiaSemana = (typeof DIAS_SEMANA)[number];

const NOMBRE_DIA: Record<string, string> = {
  domingo: "domingo",
  lunes: "lunes",
  martes: "martes",
  miercoles: "miércoles",
  jueves: "jueves",
  viernes: "viernes",
  sabado: "sábado",
};

export function nombreDia(dia: string): string {
  return NOMBRE_DIA[dia] ?? dia;
}

/** El dia de la semana de una fecha AAAA-MM-DD, sin new Date("AAAA-MM-DD"). */
export function diaDeLaSemana(fecha: string, desplazamiento = 0): DiaSemana {
  const [a, m, d] = fecha.split("-").map(Number);
  return DIAS_SEMANA[new Date(Date.UTC(a, m - 1, d + desplazamiento)).getUTCDay()];
}

export type Tarjetas = { entidades: string[]; segmentos: string[] };

/** Las entidades de las promos vigentes, para elegir en Mis tarjetas. */
export function entidadesDePromos(promos: PromoBancaria[]): string[] {
  return [...new Set(promos.map((p) => p.entidad))].sort((a, b) => a.localeCompare(b, "es"));
}

export function segmentosDePromos(promos: PromoBancaria[]): string[] {
  return [...new Set(promos.map((p) => p.segmento).filter((s): s is string => !!s))].sort((a, b) => a.localeCompare(b, "es"));
}

/**
 * Las promos de un dia en las cadenas de la zona (nombres de SEPA, como
 * zona.cadenas). Con tarjetas marcadas y `soloMias`, solo las de esas entidades.
 * Ordenadas de mayor a menor porcentaje.
 */
export function promosDelDia(
  promos: PromoBancaria[],
  dia: DiaSemana,
  cadenasZona: string[] | null,
  tarjetas: Tarjetas | null,
  soloMias = true
): PromoBancaria[] {
  const enZona = cadenasZona ? new Set(cadenasZona) : null;
  const mias = tarjetas && tarjetas.entidades.length > 0 && soloMias ? new Set(tarjetas.entidades) : null;
  return promos
    .filter((p) => p.dias.includes(dia))
    .filter((p) => !enZona || p.cadenas.some((c) => enZona.has(c)))
    .filter((p) => !mias || mias.has(p.entidad))
    .sort((a, b) => b.porcentaje - a.porcentaje || a.entidad.localeCompare(b.entidad, "es"));
}

/** El proximo dia (desde mañana, hasta una semana) con alguna promo, o null. */
export function proximoDiaConPromos(
  promos: PromoBancaria[],
  hoy: string,
  cadenasZona: string[] | null,
  tarjetas: Tarjetas | null
): { dia: DiaSemana; enDias: number } | null {
  for (let i = 1; i <= 7; i++) {
    const dia = diaDeLaSemana(hoy, i);
    if (promosDelDia(promos, dia, cadenasZona, tarjetas).length > 0) return { dia, enDias: i };
  }
  return null;
}

export type Pago =
  | { estado: "ok"; pagaEnCaja: number; teDevuelven: number; ahorro: number; topeAplicado: boolean }
  | { estado: "a-confirmar"; motivo: string }
  | { estado: "falta-minimo"; minimo: number; falta: number };

/** Cuanto se paga con una promo sobre un total a precio de lista. */
export function pagoConPromo(total: number, promo: PromoBancaria, tarjetas: Tarjetas | null): Pago {
  if (promo.rubros && promo.rubros.length > 0) return { estado: "a-confirmar", motivo: "solo algunos rubros" };
  if (promo.segmento && !(tarjetas?.segmentos ?? []).includes(promo.segmento)) {
    return { estado: "a-confirmar", motivo: `solo ${promo.segmento}` };
  }
  if (promo.compra_minima && total < promo.compra_minima) {
    return { estado: "falta-minimo", minimo: promo.compra_minima, falta: Math.ceil(promo.compra_minima - total) };
  }
  const bruto = Math.round(total * (promo.porcentaje / 100));
  const ahorro = promo.tope ? Math.min(bruto, promo.tope) : bruto;
  const topeAplicado = !!promo.tope && bruto > promo.tope;
  return promo.tipo === "descuento"
    ? { estado: "ok", pagaEnCaja: Math.round(total - ahorro), teDevuelven: 0, ahorro, topeAplicado }
    : { estado: "ok", pagaEnCaja: Math.round(total), teDevuelven: ahorro, ahorro, topeAplicado };
}

export type OpcionDePago = { promo: PromoBancaria; pago: Pago };

/**
 * Para una cadena: la promo calculable con mas ahorro y, aparte, las que
 * quedan a confirmar o no llegan al minimo. Solo canal sucursal o ambos (los
 * precios de la lista son de sucursal), salvo `conOnline`.
 */
export function opcionesDeCadena(
  total: number,
  cadena: string,
  promosDeHoy: PromoBancaria[],
  tarjetas: Tarjetas | null,
  conOnline = false
): { mejor: OpcionDePago | null; otras: OpcionDePago[] } {
  const deCadena = promosDeHoy.filter((p) => p.cadenas.includes(cadena) && (conOnline || p.canal !== "online"));
  const opciones = deCadena.map((promo) => ({ promo, pago: pagoConPromo(total, promo, tarjetas) }));
  const calculables = opciones.filter((o) => o.pago.estado === "ok") as (OpcionDePago & { pago: Extract<Pago, { estado: "ok" }> })[];
  const mejor = calculables.sort((a, b) => b.pago.ahorro - a.pago.ahorro)[0] ?? null;
  return { mejor, otras: opciones.filter((o) => o !== mejor) };
}

/** "Reintegro · sucursal · tope $ 20.000 por mes", en una linea. */
export function condicionesDePromo(promo: PromoBancaria, formatear: (n: number) => string): string {
  const partes = [
    promo.tipo === "reintegro" ? "Reintegro" : "En caja",
    promo.canal === "ambos" ? "sucursal y online" : promo.canal === "sucursal" ? "solo sucursal" : "solo online",
  ];
  if (promo.tope) {
    const periodo = { compra: "por compra", dia: "por día", semana: "por semana", mes: "por mes" }[promo.tope_periodo ?? "compra"];
    partes.push(`tope ${formatear(promo.tope)} ${periodo}`);
  } else partes.push("sin tope");
  if (promo.compra_minima) partes.push(`desde ${formatear(promo.compra_minima)}`);
  if (promo.segmento) partes.push(`solo ${promo.segmento}`);
  if (promo.rubros && promo.rubros.length > 0) partes.push("algunos rubros");
  return partes.join(" · ");
}

/** "27/11", para "revisada el 27/11", sin new Date("AAAA-MM-DD"). */
export function fechaCorta(iso: string): string {
  const [, m, d] = iso.split("-");
  return `${Number(d)}/${Number(m)}`;
}
