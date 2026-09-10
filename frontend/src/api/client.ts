import type {
  Promo,
  PromoMapa,
  QuienGana,
  Canasta,
  CanastaDetalle,
  Inflacion,
  InflacionResumen,
  ItemCanastaIA,
  ResultadoCanastaPersonalizada,
  LocalidadOpcion,
  CategoriaCanasta,
  ProductoComparado,
  ProductoDetalle,
} from "../types";

/*
  En desarrollo apunta al uvicorn local; en produccion se define VITE_API_URL al
  compilar. Vite reemplaza import.meta.env en tiempo de build, asi que el valor
  queda incrustado en el bundle: no es un secreto ni puede serlo, es la URL
  publica de la API.
*/
const API_BASE = import.meta.env.VITE_API_URL ?? "http://127.0.0.1:8000/api";

/*
  Convierte una respuesta fallida en un error que se pueda mostrar.

  Cuando la API sabe por que fallo (por ejemplo, que se alcanzo el limite diario
  de consultas a la base de datos) lo explica en "detail", y eso es lo que tiene
  que leer el visitante. "Error al traer promos: 500" no le dice nada y hace
  parecer que el sitio esta roto, cuando en realidad es un limite puesto a
  proposito para que el proyecto no genere costos.
*/
async function fallar(respuesta: Response, contexto: string): Promise<never> {
  let detalle: string | undefined;
  try {
    const cuerpo = await respuesta.json();
    if (typeof cuerpo?.detail === "string") detalle = cuerpo.detail;
  } catch {
    // El cuerpo no era JSON, por ejemplo un error del balanceador.
  }
  throw new Error(detalle ?? `${contexto} (error ${respuesta.status})`);
}

type FiltrosPromos = {
  busqueda?: string;
  provincia?: string;
  limite?: number;
};

type BoundingBox = {
  latMin: number;
  latMax: number;
  lngMin: number;
  lngMax: number;
};

type FiltrosMapa = FiltrosPromos & {
  bbox?: BoundingBox;
};

type RespuestaMapa = {
  promos: PromoMapa[];
  hay_mas: boolean;
};

function armarQuery(filtros: FiltrosPromos): string {
  const params = new URLSearchParams();
  if (filtros.limite) params.set("limite", String(filtros.limite));
  if (filtros.busqueda?.trim()) params.set("busqueda", filtros.busqueda.trim());
  if (filtros.provincia) params.set("provincia", filtros.provincia);
  return params.toString();
}

export async function obtenerPromos(filtros: FiltrosPromos): Promise<Promo[]> {
  const query = armarQuery(filtros);
  const respuesta = await fetch(`${API_BASE}/promos?${query}`);
  if (!respuesta.ok) await fallar(respuesta, "Error al traer promos");
  return respuesta.json();
}

export async function obtenerPromosMapa(filtros: FiltrosMapa): Promise<RespuestaMapa> {
  const params = new URLSearchParams(armarQuery(filtros));
  if (filtros.bbox) {
    params.set("lat_min", String(filtros.bbox.latMin));
    params.set("lat_max", String(filtros.bbox.latMax));
    params.set("lng_min", String(filtros.bbox.lngMin));
    params.set("lng_max", String(filtros.bbox.lngMax));
  }
  const respuesta = await fetch(`${API_BASE}/promos/mapa?${params.toString()}`);
  if (!respuesta.ok) await fallar(respuesta, "Error al traer promos del mapa");
  return respuesta.json();
}

export async function obtenerQuienGana(categoria: string): Promise<QuienGana[]> {
  const params = new URLSearchParams();
  if (categoria) params.set("categoria", categoria);
  const respuesta = await fetch(`${API_BASE}/quien-gana?${params.toString()}`);
  if (!respuesta.ok) await fallar(respuesta, "Error al traer quien gana");
  return respuesta.json();
}

export async function obtenerCategoriasDisponibles(): Promise<string[]> {
  const respuesta = await fetch(`${API_BASE}/quien-gana/categorias`);
  if (!respuesta.ok) await fallar(respuesta, "Error al traer categorias");
  return respuesta.json();
}

export async function obtenerCanasta(filtros: FiltrosPromos): Promise<Canasta[]> {
  const query = armarQuery(filtros);
  const respuesta = await fetch(`${API_BASE}/canasta?${query}`);
  if (!respuesta.ok) await fallar(respuesta, "Error al traer canasta");
  return respuesta.json();
}

export async function obtenerCanastaDetalle(
  localidad: string,
  provincia: string
): Promise<CanastaDetalle[]> {
  const params = new URLSearchParams({ localidad, provincia });
  const respuesta = await fetch(`${API_BASE}/canasta/detalle?${params.toString()}`);
  if (!respuesta.ok) await fallar(respuesta, "Error al traer el detalle");
  return respuesta.json();
}

export async function obtenerInflacionResumen(): Promise<InflacionResumen[]> {
  const respuesta = await fetch(`${API_BASE}/inflacion/resumen`);
  if (!respuesta.ok) await fallar(respuesta, "Error al traer el resumen");
  return respuesta.json();
}

export async function obtenerInflacion(categoria: string): Promise<Inflacion[]> {
  const params = new URLSearchParams();
  if (categoria) params.set("categoria", categoria);
  const respuesta = await fetch(`${API_BASE}/inflacion?${params.toString()}`);
  if (!respuesta.ok) await fallar(respuesta, "Error al traer inflacion");
  return respuesta.json();
}

export async function interpretarCanasta(descripcion: string): Promise<{ items: ItemCanastaIA[] }> {
  const respuesta = await fetch(`${API_BASE}/canasta-personalizada/interpretar`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ descripcion }),
  });
  if (!respuesta.ok) await fallar(respuesta, "Error al interpretar");
  return respuesta.json();
}

export async function calcularCanastaPersonalizada(
  items: ItemCanastaIA[],
  localidades: LocalidadOpcion[]
): Promise<ResultadoCanastaPersonalizada> {
  const respuesta = await fetch(`${API_BASE}/canasta-personalizada/calcular`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ items, localidades }),
  });
  if (!respuesta.ok) await fallar(respuesta, "Error al calcular");
  return respuesta.json();
}

export async function buscarLocalidades(busqueda: string): Promise<LocalidadOpcion[]> {
  const params = new URLSearchParams();
  if (busqueda.trim()) params.set("busqueda", busqueda.trim());
  const respuesta = await fetch(`${API_BASE}/canasta-personalizada/localidades?${params.toString()}`);
  if (!respuesta.ok) await fallar(respuesta, "Error al buscar localidades");
  return respuesta.json();
}

export async function obtenerCategoriasCanasta(): Promise<CategoriaCanasta[]> {
  const respuesta = await fetch(`${API_BASE}/canasta-personalizada/categorias`);
  if (!respuesta.ok) await fallar(respuesta, "Error al traer las categorias");
  return respuesta.json();
}

export async function buscarProductos(consulta: string): Promise<ProductoComparado[]> {
  const params = new URLSearchParams({ q: consulta.trim() });
  const respuesta = await fetch(`${API_BASE}/mismo-producto/buscar?${params.toString()}`);
  if (!respuesta.ok) await fallar(respuesta, "Error al buscar productos");
  return respuesta.json();
}

export async function obtenerProductosDestacados(): Promise<ProductoComparado[]> {
  const respuesta = await fetch(`${API_BASE}/mismo-producto/destacados`);
  if (!respuesta.ok) await fallar(respuesta, "Error al traer los destacados");
  return respuesta.json();
}

export async function obtenerProducto(idProducto: string): Promise<ProductoDetalle> {
  const respuesta = await fetch(`${API_BASE}/mismo-producto/${encodeURIComponent(idProducto)}`);
  if (!respuesta.ok) await fallar(respuesta, "Error al traer el producto");
  return respuesta.json();
}
