import { nombreCadena } from "./nombres";
import { nombreProvincia } from "./provincias";
import { normalizar } from "./texto";

/*
  La zona del usuario (2026-11, openspec/changes/zona-compartida).

  Antes cada pagina tenia su propia nocion de lugar (el mapa de Promos, las
  localidades de Tu canasta, el punto de "Donde comprarla") y ninguna se
  enteraba de las otras: quien elegia su localidad en el inicio y buscaba un
  producto llegaba a Mismo producto sin zona. Ahora hay una sola, que se
  recuerda en el navegador y viaja en el link (?zona=<provincia>:<nombre>).

  `cadenas` son los nombres tal como los manda la API: se usan para pedirle
  /quien-gana/zona. Para comparar con lo que se muestra va cadenasVisibles.
*/
export type Zona = {
  nombre: string;
  provincia: string;
  latitud: number;
  longitud: number;
  /** Las cadenas cerca: con sucursal en el lugar o a menos de 3 km de su
   *  centro (cadenas-cerca-de-tu-zona). */
  cadenas: string[];
  /** Solo si hay una sola cadena cerca: la sucursal mas cercana de otra. */
  otra_cadena_cerca?: { cadena: string; km: number };
};

const CLAVE_STORAGE = "changuito.zona";
export const PARAMETRO_URL = "zona";

export function rotuloZona(zona: Pick<Zona, "nombre" | "provincia">): string {
  return `${zona.nombre}, ${nombreProvincia(zona.provincia)}`;
}

/** Los nombres de cadena como se muestran, para comparar con las respuestas ya convertidas. */
export function cadenasVisibles(zona: Zona): Set<string> {
  return new Set(zona.cadenas.map(nombreCadena));
}

function mismaZona(a: Pick<Zona, "nombre" | "provincia">, b: Pick<Zona, "nombre" | "provincia">): boolean {
  return a.provincia === b.provincia && normalizar(a.nombre) === normalizar(b.nombre);
}

/** La zona de la lista que corresponde a un nombre y provincia, o undefined. */
export function encontrarZona(zonas: Zona[], buscada: Pick<Zona, "nombre" | "provincia">): Zona | undefined {
  return zonas.find((z) => mismaZona(z, buscada));
}

/* ---------- link ---------- */

export function zonaAParametro(zona: Pick<Zona, "nombre" | "provincia">): string {
  return `${zona.provincia}:${zona.nombre}`;
}

/** "AR-C:Palermo" -> {provincia, nombre}. El codigo de provincia no lleva ":". */
export function parametroAZona(valor: string | null): Pick<Zona, "nombre" | "provincia"> | null {
  if (!valor) return null;
  const corte = valor.indexOf(":");
  if (corte <= 0 || corte === valor.length - 1) return null;
  return { provincia: valor.slice(0, corte), nombre: valor.slice(corte + 1) };
}

/**
 * El search de la URL con la zona puesta (o sacada), sin tocar los demas
 * parametros: ?q= de Mismo producto, ?c= de Tu canasta.
 */
export function searchConZona(search: string, zona: Pick<Zona, "nombre" | "provincia"> | null): string {
  const params = new URLSearchParams(search);
  if (zona) params.set(PARAMETRO_URL, zonaAParametro(zona));
  else params.delete(PARAMETRO_URL);
  const texto = params.toString();
  return texto ? `?${texto}` : "";
}

/* ---------- navegador ---------- */

// En modo privado o con el almacenamiento lleno, localStorage tira excepcion:
// la zona dura lo que la pagina abierta y nada se rompe.
export function guardarZona(zona: Zona | null): void {
  try {
    if (zona) window.localStorage.setItem(CLAVE_STORAGE, JSON.stringify(zonaAParametro(zona)));
    else window.localStorage.removeItem(CLAVE_STORAGE);
  } catch {
    // Sin almacenamiento: la zona queda solo en memoria.
  }
}

export function leerZonaGuardada(): Pick<Zona, "nombre" | "provincia"> | null {
  try {
    const crudo = window.localStorage.getItem(CLAVE_STORAGE);
    return crudo ? parametroAZona(JSON.parse(crudo)) : null;
  } catch {
    return null;
  }
}

/**
 * La zona con la que arranca el sitio: la del link gana sobre la guardada,
 * como con la canasta. Una del link que no esta en la lista se descarta y se
 * avisa; una guardada que ya no existe se descarta en silencio.
 */
export function zonaInicial(
  zonas: Zona[],
  search: string,
  guardada: Pick<Zona, "nombre" | "provincia"> | null
): { zona: Zona | null; desconocida: string | null } {
  const delLink = parametroAZona(new URLSearchParams(search).get(PARAMETRO_URL));
  if (delLink) {
    const zona = encontrarZona(zonas, delLink);
    if (zona) return { zona, desconocida: null };
    const deGuardada = guardada ? encontrarZona(zonas, guardada) ?? null : null;
    return { zona: deGuardada, desconocida: delLink.nombre };
  }
  return { zona: guardada ? encontrarZona(zonas, guardada) ?? null : null, desconocida: null };
}

/* ---------- Tu canasta ---------- */

/**
 * La localidad cotizable de Tu canasta que corresponde a la zona, o null.
 * Tu canasta cotiza contra las localidades de los precios por categoria, que no
 * siempre coinciden con los lugares del mapa (un barrio puede tener sucursales
 * y no precios de la canasta): sin coincidencia exacta de nombre y provincia no
 * se agrega nada y la pagina lo avisa.
 */
export function localidadDeZona<T extends { localidad: string; provincia: string }>(
  opciones: T[],
  zona: Pick<Zona, "nombre" | "provincia">
): T | null {
  return opciones.find((o) => o.provincia === zona.provincia && normalizar(o.localidad) === normalizar(zona.nombre)) ?? null;
}

/* ---------- buscar ---------- */

/** Sin mayusculas ni tildes; las que empiezan con lo buscado van primero. */
export function buscarZonas(zonas: Zona[], texto: string, limite = 8): Zona[] {
  const buscado = normalizar(texto.trim());
  if (buscado.length < 2) return [];
  const coinciden = zonas.filter((z) => normalizar(z.nombre).includes(buscado));
  const empieza = (z: Zona) => (normalizar(z.nombre).startsWith(buscado) ? 0 : 1);
  return coinciden.sort((a, b) => empieza(a) - empieza(b)).slice(0, limite);
}

/** Distancia sobre la esfera, en km. */
export function distanciaKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const rad = Math.PI / 180;
  const a =
    Math.sin(((lat2 - lat1) * rad) / 2) ** 2 +
    Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(((lng2 - lng1) * rad) / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(a));
}

/** El lugar con sucursales mas cercano a un punto: "usar mi ubicacion". */
export function zonaMasCercana(zonas: Zona[], latitud: number, longitud: number): Zona | null {
  let mejor: Zona | null = null;
  let distancia = Infinity;
  for (const z of zonas) {
    const d = distanciaKm(latitud, longitud, z.latitud, z.longitud);
    if (d < distancia) {
      distancia = d;
      mejor = z;
    }
  }
  return mejor;
}
