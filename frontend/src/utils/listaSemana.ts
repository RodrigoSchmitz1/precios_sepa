/*
  "Tu lista esta semana" (openspec app-para-el-usuario): la tarjeta de la
  portada dice cuanto cambio el total de tu lista desde la ultima semana en que
  la viste, en la misma cadena y con los mismos productos. Todo queda en el
  telefono: un solo registro con la semana, la huella de la lista, la cadena,
  el total y el total de la semana anterior. Inspirado en el mail semanal de
  Convi, pero sin mail ni cuentas.
*/
import type { ItemLista } from "../types";

const CLAVE = "changuito.lista.semana.v1";

export type RegistroSemana = {
  /** El lunes de la semana, AAAA-MM-DD. */
  semana: string;
  huella: string;
  cadena: string;
  total: number;
  /** El total de la semana anterior, si la lista y la cadena eran las mismas. */
  anterior: number | null;
};

export type Actual = Omit<RegistroSemana, "anterior">;

/** El lunes de la semana de una fecha AAAA-MM-DD, sin new Date("AAAA-MM-DD"). */
export function lunesDe(fecha: string): string {
  const [a, m, d] = fecha.split("-").map(Number);
  const dia = new Date(Date.UTC(a, m - 1, d));
  const desdeLunes = (dia.getUTCDay() + 6) % 7;
  dia.setUTCDate(dia.getUTCDate() - desdeLunes);
  return dia.toISOString().slice(0, 10);
}

/** Que productos y cantidades tiene la lista, y entre que cadenas se compara. */
export function huellaDeLista(lista: ItemLista[], cadenas: string[]): string {
  const items = lista.map((i) => `${i.id_producto}x${i.cantidad}`).sort();
  return `${items.join(",")}|${[...cadenas].sort().join(",")}`;
}

export function leerRegistroSemana(): RegistroSemana | null {
  try {
    const valor = JSON.parse(window.localStorage.getItem(CLAVE) ?? "null");
    return valor && typeof valor.semana === "string" && typeof valor.total === "number" ? valor : null;
  } catch {
    return null;
  }
}

export function guardarRegistroSemana(registro: RegistroSemana): void {
  try {
    window.localStorage.setItem(CLAVE, JSON.stringify(registro));
  } catch {
    /* sin persistencia no hay comparacion semanal: no rompe nada */
  }
}

function mismaLista(registro: RegistroSemana, actual: Actual): boolean {
  return registro.huella === actual.huella && registro.cadena === actual.cadena;
}

/** El total de referencia de la semana anterior, o null si no hay con que comparar. */
function anteriorDe(registro: RegistroSemana | null, actual: Actual): number | null {
  if (!registro || !mismaLista(registro, actual)) return null;
  return registro.semana === actual.semana ? registro.anterior : registro.total;
}

/** Cuanto cambio el total contra la semana anterior (negativo: bajo), o null. */
export function cambioDeLaSemana(registro: RegistroSemana | null, actual: Actual): number | null {
  const anterior = anteriorDe(registro, actual);
  return anterior === null ? null : Math.round(actual.total - anterior);
}

/** El registro a guardar despues de ver la lista hoy. */
export function registrarSemana(registro: RegistroSemana | null, actual: Actual): RegistroSemana {
  return { ...actual, anterior: anteriorDe(registro, actual) };
}
