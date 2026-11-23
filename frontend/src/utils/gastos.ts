/*
  Mis gastos se guardan en el navegador, como Tu lista: sin cuentas y sin
  mandarlos al servidor (openspec mis-gastos-y-barra-nueva). Todos los accesos
  van envueltos: en modo incognito o con el almacenamiento lleno localStorage
  tira excepcion, y eso no puede romper la pagina.
*/
import type { Gasto, LineaGasto, TicketLeido } from "../types";

const CLAVE = "changuito.gastos.v1";
const CLAVE_AVISO = "changuito.gastos.aviso.v1";
/** Unos 3 KB por ticket: 500 son ~1,5 MB, lejos del limite de ~5 MB del navegador. */
export const MAXIMO_GASTOS = 500;
export const CATEGORIA_SIN_DETALLE = "Sin detalle";

const FECHA = /^\d{4}-\d{2}-\d{2}$/;

function esGasto(x: unknown): x is Gasto {
  const g = x as Gasto;
  return (
    typeof g?.id === "string" &&
    (g.origen === "foto" || g.origen === "mano") &&
    typeof g.cadena === "string" &&
    typeof g.fecha === "string" &&
    FECHA.test(g.fecha) &&
    typeof g.total === "number" &&
    Array.isArray(g.lineas) &&
    Array.isArray(g.descuentos)
  );
}

export function leerGastos(): Gasto[] {
  try {
    const crudo = window.localStorage.getItem(CLAVE);
    if (!crudo) return [];
    const datos: unknown = JSON.parse(crudo);
    return Array.isArray(datos) ? datos.filter(esGasto) : [];
  } catch {
    return [];
  }
}

/** true si quedo guardado; false si el navegador no deja guardar. */
export function guardarGastos(gastos: Gasto[]): boolean {
  try {
    window.localStorage.setItem(CLAVE, JSON.stringify(gastos));
    return true;
  } catch {
    return false;
  }
}

export function avisoAceptado(): boolean {
  try {
    return window.localStorage.getItem(CLAVE_AVISO) === "1";
  } catch {
    return false;
  }
}

export function aceptarAviso(): void {
  try {
    window.localStorage.setItem(CLAVE_AVISO, "1");
  } catch {
    /* sin almacenamiento, el aviso vuelve a aparecer la proxima vez */
  }
}

/** Borrar todos los gastos deja el aviso aceptado: ya lo leyo. */
export function borrarTodos(): boolean {
  try {
    window.localStorage.removeItem(CLAVE);
    return true;
  } catch {
    return false;
  }
}

/** Mismo ticket: misma cadena, mismo comprobante, misma fecha y mismo total.
 *  Sin numero de comprobante no se puede afirmar que es el mismo. */
export function buscarDuplicado(gastos: Gasto[], nuevo: Pick<Gasto, "cadena" | "comprobante" | "fecha" | "total">): Gasto | null {
  if (!nuevo.comprobante) return null;
  const cadena = nuevo.cadena.trim().toLowerCase();
  return (
    gastos.find(
      (g) =>
        g.comprobante === nuevo.comprobante &&
        g.fecha === nuevo.fecha &&
        Math.abs(g.total - nuevo.total) < 0.01 &&
        g.cadena.trim().toLowerCase() === cadena,
    ) ?? null
  );
}

export function nuevoId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Suma un gasto si no se paso el tope; devuelve la lista nueva o null si no entra. */
export function agregarGasto(gastos: Gasto[], gasto: Gasto): Gasto[] | null {
  if (gastos.length >= MAXIMO_GASTOS) return null;
  return [...gastos, gasto];
}

export function gastoDeTicket(
  ticket: TicketLeido,
  revisado: { cadena: string; fecha: string; total: number; lineas: LineaGasto[] },
  ahora = Date.now(),
): Gasto {
  return {
    id: nuevoId(),
    origen: "foto",
    cadena: revisado.cadena,
    cadenas_sepa: ticket.cadenas_sepa,
    sucursal: ticket.sucursal,
    fecha: revisado.fecha,
    comprobante: ticket.comprobante,
    total: revisado.total,
    lineas: revisado.lineas,
    descuentos: ticket.descuentos,
    creado: ahora,
  };
}

export function gastoAMano(cadena: string, fecha: string, total: number, ahora = Date.now()): Gasto {
  return {
    id: nuevoId(),
    origen: "mano",
    cadena,
    cadenas_sepa: [],
    sucursal: null,
    fecha,
    comprobante: null,
    total,
    lineas: [],
    descuentos: [],
    creado: ahora,
  };
}

/** Lo que falta (o sobra) entre las lineas menos los descuentos y el total impreso. */
export function diferenciaConTotal(lineas: LineaGasto[], descuentos: { importe: number }[], total: number): number {
  const suma = lineas.reduce((s, l) => s + l.importe, 0) - descuentos.reduce((s, d) => s + d.importe, 0);
  return Math.round((total - suma) * 100) / 100;
}

/** Hoy en Argentina como "AAAA-MM-DD", sin depender del huso del telefono. */
export function hoyEnArgentina(ahora = new Date()): string {
  const partes = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Argentina/Buenos_Aires", year: "numeric", month: "2-digit", day: "2-digit" }).format(ahora);
  return partes;
}

/*
  Las reglas de la comparacion las define la API (api/tickets.py) y llegan con
  cada lectura: se guardan para usarlas al abrir un ticket guardado, sin copiar
  el numero aca. Un gasto de foto solo existe si este telefono ya leyo un
  ticket, asi que siempre hay un valor; si falta, no se compara.
*/
const CLAVE_CONSTANTES = "changuito.gastos.constantes.v1";

export function guardarConstantes(constantes: { cobertura_minima_comparacion: number }): void {
  try {
    window.localStorage.setItem(CLAVE_CONSTANTES, JSON.stringify(constantes));
  } catch {
    /* sin almacenamiento tampoco hay gastos guardados que comparar */
  }
}

export function leerCoberturaMinima(): number | null {
  try {
    const valor = JSON.parse(window.localStorage.getItem(CLAVE_CONSTANTES) ?? "null")?.cobertura_minima_comparacion;
    return typeof valor === "number" ? valor : null;
  } catch {
    return null;
  }
}
