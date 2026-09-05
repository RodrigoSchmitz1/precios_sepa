import type { Promo, PromoMapa, QuienGana, Canasta } from "../types";

const API_BASE = "http://127.0.0.1:8000";

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
  if (!respuesta.ok) throw new Error(`Error al traer promos: ${respuesta.status}`);
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
  if (!respuesta.ok) throw new Error(`Error al traer promos del mapa: ${respuesta.status}`);
  return respuesta.json();
}

export async function obtenerQuienGana(categoria: string): Promise<QuienGana[]> {
  const params = new URLSearchParams();
  if (categoria) params.set("categoria", categoria);
  const respuesta = await fetch(`${API_BASE}/quien-gana?${params.toString()}`);
  if (!respuesta.ok) throw new Error(`Error al traer quien gana: ${respuesta.status}`);
  return respuesta.json();
}

export async function obtenerCategoriasDisponibles(): Promise<string[]> {
  const respuesta = await fetch(`${API_BASE}/quien-gana/categorias`);
  if (!respuesta.ok) throw new Error(`Error al traer categorias: ${respuesta.status}`);
  return respuesta.json();
}

export async function obtenerCanasta(filtros: FiltrosPromos): Promise<Canasta[]> {
  const query = armarQuery(filtros);
  const respuesta = await fetch(`${API_BASE}/canasta?${query}`);
  if (!respuesta.ok) throw new Error(`Error al traer canasta: ${respuesta.status}`);
  return respuesta.json();
}
