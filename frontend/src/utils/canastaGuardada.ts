/*
  Persistencia de la canasta personalizada, sin cuentas ni backend.

  Dos mecanismos que se complementan:
  - localStorage: "vuelvo manana y sigo donde estaba". Automatico, por navegador.
  - URL: "me lo mando a mi mismo o se lo muestro a alguien". La URL ES el
    almacenamiento, asi que cruza dispositivos sin guardar nada en ningun lado.

  Se descarto identificar por email: sin verificacion no es autenticacion sino
  una clave adivinable (cualquiera escribe el mail de otro y le abre la canasta,
  que revela habitos de consumo y zona), y con verificacion hace falta
  infraestructura de mails y pasa a haber datos personales que proteger. Nada de
  eso aporta al producto.
*/

import type { ItemCanastaIA, LocalidadOpcion } from "../types";

export const GAMAS = ["economico", "medio", "premium"] as const;
export type Gama = (typeof GAMAS)[number];

export type CanastaGuardada = {
  descripcion: string;
  items: ItemCanastaIA[];
  localidades: LocalidadOpcion[];
};

const CLAVE_STORAGE = "precios_sepa.canasta.v1";
export const PARAMETRO_URL = "c";

/* ---------- localStorage ---------- */

/*
  Todos los accesos van envueltos: en modo incognito, con cookies bloqueadas o
  con el storage lleno, localStorage tira excepcion en vez de devolver vacio.
  Que falle el guardado nunca puede romper la pagina.
*/
export function guardarEnNavegador(canasta: CanastaGuardada): void {
  try {
    window.localStorage.setItem(CLAVE_STORAGE, JSON.stringify(canasta));
  } catch {
    /* sin persistencia, la sesion sigue funcionando igual */
  }
}

export function leerDelNavegador(): CanastaGuardada | null {
  try {
    const crudo = window.localStorage.getItem(CLAVE_STORAGE);
    if (!crudo) return null;
    return validarCanasta(JSON.parse(crudo));
  } catch {
    return null;
  }
}

export function borrarDelNavegador(): void {
  try {
    window.localStorage.removeItem(CLAVE_STORAGE);
  } catch {
    /* idem */
  }
}

/* ---------- URL compartible ---------- */

/*
  Formato compacto v1: {v, d, i:[[categoria,cantidad,unidad,gama]], l:[[loc,prov]]}
  Se omite "razon" a proposito: es prosa generada por el modelo y multiplicaria
  el largo de la URL. Una canasta compartida se puede recalcular igual, solo
  pierde el texto explicativo de cada item.
*/
type CanastaCompacta = {
  v: 1;
  d: string;
  i: [string, number, string, string][];
  l: [string, string][];
};

export function canastaAUrl(canasta: CanastaGuardada, base: string): string {
  const compacta: CanastaCompacta = {
    v: 1,
    d: canasta.descripcion,
    i: canasta.items.map((it) => [it.categoria, it.cantidad, it.unidad, it.gama]),
    l: canasta.localidades.map((lo) => [lo.localidad, lo.provincia]),
  };
  const url = new URL(base);
  url.searchParams.set(PARAMETRO_URL, aBase64Url(JSON.stringify(compacta)));
  return url.toString();
}

export function canastaDesdeUrl(busqueda: string): CanastaGuardada | null {
  const codigo = new URLSearchParams(busqueda).get(PARAMETRO_URL);
  if (!codigo) return null;
  try {
    const datos = JSON.parse(deBase64Url(codigo)) as CanastaCompacta;
    if (datos?.v !== 1 || !Array.isArray(datos.i)) return null;
    return validarCanasta({
      descripcion: typeof datos.d === "string" ? datos.d : "",
      items: datos.i.map(([categoria, cantidad, unidad, gama]) => ({
        categoria,
        cantidad,
        unidad,
        gama,
        razon: "",
      })),
      localidades: (datos.l ?? []).map(([localidad, provincia]) => ({ localidad, provincia })),
    });
  } catch {
    return null;
  }
}

/* ---------- Validacion ---------- */

/*
  Lo que llega por URL lo escribio cualquiera, y lo de localStorage puede ser de
  una version vieja del formato. Se valida campo por campo y ante la minima duda
  se descarta todo: es preferible arrancar con la canasta vacia que renderizar
  datos rotos o mandarle basura al endpoint de calculo.
*/
function validarCanasta(datos: unknown): CanastaGuardada | null {
  if (typeof datos !== "object" || datos === null) return null;
  const posible = datos as Record<string, unknown>;
  if (!Array.isArray(posible.items)) return null;

  const items: ItemCanastaIA[] = [];
  for (const crudo of posible.items) {
    const item = validarItem(crudo);
    if (!item) return null;
    items.push(item);
  }

  const localidades: LocalidadOpcion[] = [];
  for (const crudo of Array.isArray(posible.localidades) ? posible.localidades : []) {
    const loc = crudo as Record<string, unknown>;
    if (typeof loc?.localidad !== "string" || typeof loc?.provincia !== "string") return null;
    if (!loc.localidad.trim() || !loc.provincia.trim()) return null;
    localidades.push({ localidad: loc.localidad, provincia: loc.provincia });
  }

  return {
    descripcion: typeof posible.descripcion === "string" ? posible.descripcion : "",
    items,
    // El backend acepta hasta 3 zonas; recortar aca evita un 422 por una URL editada a mano.
    localidades: localidades.slice(0, 3),
  };
}

function validarItem(crudo: unknown): ItemCanastaIA | null {
  const item = crudo as Record<string, unknown>;
  if (typeof item?.categoria !== "string" || !item.categoria.trim()) return null;
  if (typeof item?.unidad !== "string" || !item.unidad.trim()) return null;
  if (typeof item?.gama !== "string" || !(GAMAS as readonly string[]).includes(item.gama)) return null;
  const cantidad = Number(item?.cantidad);
  if (!Number.isFinite(cantidad) || cantidad <= 0) return null;
  return {
    categoria: item.categoria,
    cantidad,
    unidad: item.unidad,
    gama: item.gama,
    razon: typeof item.razon === "string" ? item.razon : "",
  };
}

/* ---------- base64url sobre UTF-8 ---------- */

/*
  btoa/atob trabajan byte a byte, asi que rompen con acentos y enies si se les
  pasa el string directo. Hay que convertir a UTF-8 primero. Y se usa base64url
  (- _ sin =) para no depender de que la URL quede escapada correctamente.
*/
function aBase64Url(texto: string): string {
  const bytes = new TextEncoder().encode(texto);
  let binario = "";
  bytes.forEach((byte) => {
    binario += String.fromCharCode(byte);
  });
  return btoa(binario).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function deBase64Url(codigo: string): string {
  const base64 = codigo.replace(/-/g, "+").replace(/_/g, "/");
  const binario = atob(base64);
  const bytes = Uint8Array.from(binario, (caracter) => caracter.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}
