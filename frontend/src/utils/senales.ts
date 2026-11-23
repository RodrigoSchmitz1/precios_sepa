/*
  Señales anonimas de uso (openspec senales-anonimas).

  Prendidas por defecto cuando el servicio las activa (SENALES_ACTIVAS), con un
  aviso de una linea la primera vez y un interruptor que las apaga en un toque.
  Rodrigo eligio este modelo el 2026-11-23: con un "Si / No" casi nadie suma, y
  esconder el "no" seria enganoso. Para no necesitar consentimiento, son anonimas
  de verdad: el identificador cambia cada dia, asi que no hay perfil de nadie.

  Solo tres eventos: abrir la pagina de una categoria de promos, pedir o quitar
  un aviso, y buscar una promo (la API guarda la categoria, nunca el texto).
  Viajan en tandas con sendBeacon. Todo acceso a localStorage va envuelto: en
  incognito o con el almacenamiento lleno tira excepcion.
*/
import { useSyncExternalStore } from "react";
import { enviarSenales, obtenerEstadoSenales } from "../api/client";
import { hoyEnArgentina } from "./gastos";
import type { Zona } from "./zona";

export type EventoSenal =
  | { tipo: "vista_rubro"; rubro: string }
  | { tipo: "aviso_pedido" | "aviso_quitado"; id_producto: string }
  | { tipo: "busqueda"; texto: string };

type Guardado = { apagadas: boolean; avisoVisto: boolean; id: string | null; dia: string | null };

const CLAVE = "changuito.senales.v1";
const EVENTO = "changuito-senales";
export const MAXIMO_POR_TANDA = 20;
const ESPERA_MS = 3000;

const VACIO: Guardado = { apagadas: false, avisoVisto: false, id: null, dia: null };

let crudoLeido: string | null | undefined;
let guardado: Guardado = VACIO;

function leer(): Guardado {
  try {
    const crudo = window.localStorage.getItem(CLAVE);
    if (crudo === crudoLeido) return guardado;
    crudoLeido = crudo;
    const datos = crudo ? (JSON.parse(crudo) as Partial<Guardado>) : {};
    guardado = {
      apagadas: datos.apagadas === true,
      avisoVisto: datos.avisoVisto === true,
      id: typeof datos.id === "string" ? datos.id : null,
      dia: typeof datos.dia === "string" ? datos.dia : null,
    };
  } catch {
    // Sin almacenamiento se queda con lo que haya en memoria.
  }
  return guardado;
}

function escribir(cambios: Partial<Guardado>): void {
  guardado = { ...leer(), ...cambios };
  try {
    const crudo = JSON.stringify(guardado);
    window.localStorage.setItem(CLAVE, crudo);
    crudoLeido = crudo;
  } catch {
    // En memoria igual vale para esta visita.
  }
  avisar();
}

/* ---------- el servicio ---------- */

let servicio: boolean | null = null;
let pedido: Promise<boolean> | null = null;

function consultarServicio(): Promise<boolean> {
  pedido ??= obtenerEstadoSenales()
    .then((e) => e.activas)
    .catch(() => false)
    .then((activas) => {
      servicio = activas;
      if (!activas) cola = [];
      avisar();
      return activas;
    });
  return pedido;
}

/* ---------- la cola ---------- */

let cola: EventoSenal[] = [];
let zonaDeLaCola: Pick<Zona, "provincia" | "nombre"> | null = null;
let temporizador: ReturnType<typeof setTimeout> | null = null;

/** El identificador del dia: otro cada dia, para que no haya perfil de nadie. */
export function idDelDia(hoy = hoyEnArgentina()): string {
  const g = leer();
  if (g.id && g.dia === hoy) return g.id;
  const id = crypto.randomUUID();
  escribir({ id, dia: hoy });
  return id;
}

export function vaciarCola(): void {
  if (temporizador) clearTimeout(temporizador);
  temporizador = null;
  if (cola.length === 0 || servicio !== true || leer().apagadas) {
    cola = [];
    return;
  }
  while (cola.length > 0) {
    const tanda = cola.splice(0, MAXIMO_POR_TANDA);
    enviarSenales({
      id: idDelDia(),
      zona: zonaDeLaCola ? { provincia: zonaDeLaCola.provincia, nombre: zonaDeLaCola.nombre } : null,
      eventos: tanda,
    });
  }
}

/** Registra un evento. No hace nada si el servicio no las activa o si estan apagadas. */
export function senal(evento: EventoSenal, zona: Pick<Zona, "provincia" | "nombre"> | null): void {
  if (servicio === false || leer().apagadas) return;
  // Una tanda lleva una sola zona: si cambia, se manda lo anterior primero.
  if (cola.length > 0 && (zonaDeLaCola?.nombre !== zona?.nombre || zonaDeLaCola?.provincia !== zona?.provincia)) {
    vaciarCola();
  }
  zonaDeLaCola = zona;
  cola.push(evento);
  void consultarServicio().then(() => {
    if (cola.length >= MAXIMO_POR_TANDA) vaciarCola();
    else temporizador ??= setTimeout(vaciarCola, ESPERA_MS);
  });
}

if (typeof document !== "undefined") {
  // Al salir de la pestaña o cerrar la app se manda lo pendiente: sendBeacon sobrevive al cierre.
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") vaciarCola();
  });
}

/* ---------- interruptor, aviso y hoja ---------- */

let hojaAbierta = false;

export function apagarSenales(): void {
  cola = [];
  escribir({ apagadas: true, avisoVisto: true });
}

export function prenderSenales(): void {
  escribir({ apagadas: false, avisoVisto: true });
}

export function marcarAvisoVisto(): void {
  escribir({ avisoVisto: true });
}

export function abrirHojaSenales(): void {
  hojaAbierta = true;
  marcarAvisoVisto();
}

export function cerrarHojaSenales(): void {
  hojaAbierta = false;
  avisar();
}

export type EstadoSenales = { activas: boolean; apagadas: boolean; avisoVisto: boolean; hojaAbierta: boolean };

let instantanea: EstadoSenales = { activas: false, apagadas: false, avisoVisto: false, hojaAbierta: false };

function calcular(): EstadoSenales {
  const g = leer();
  const nuevo = { activas: servicio === true, apagadas: g.apagadas, avisoVisto: g.avisoVisto, hojaAbierta };
  if (
    nuevo.activas !== instantanea.activas ||
    nuevo.apagadas !== instantanea.apagadas ||
    nuevo.avisoVisto !== instantanea.avisoVisto ||
    nuevo.hojaAbierta !== instantanea.hojaAbierta
  ) {
    instantanea = nuevo;
  }
  return instantanea;
}

const oyentes = new Set<() => void>();
function avisar(): void {
  oyentes.forEach((o) => o());
}

function suscribir(oyente: () => void): () => void {
  oyentes.add(oyente);
  void consultarServicio();
  const deOtraPestana = (e: StorageEvent) => e.key === CLAVE && oyente();
  window.addEventListener("storage", deOtraPestana);
  window.addEventListener(EVENTO, oyente);
  return () => {
    oyentes.delete(oyente);
    window.removeEventListener("storage", deOtraPestana);
    window.removeEventListener(EVENTO, oyente);
  };
}

const INICIAL: EstadoSenales = { activas: false, apagadas: false, avisoVisto: false, hojaAbierta: false };

export function useSenales(): EstadoSenales {
  return useSyncExternalStore(suscribir, calcular, () => INICIAL);
}

/** Solo para los tests: vuelve al estado de una visita nueva. */
export function reiniciarSenalesParaTests(): void {
  servicio = null;
  pedido = null;
  cola = [];
  zonaDeLaCola = null;
  hojaAbierta = false;
  crudoLeido = undefined;
  guardado = VACIO;
  instantanea = INICIAL;
  if (temporizador) clearTimeout(temporizador);
  temporizador = null;
}
