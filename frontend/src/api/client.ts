import type { Promo, PromoMapa, QuienGana } from "../types";

const API_BASE = "http://127.0.0.1:8000";

type FiltrosPromos = {
  busqueda?: string;
  provincia?: string;
  limite?: number;
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

export async function obtenerPromosMapa(filtros: FiltrosPromos): Promise<PromoMapa[]> {
  const query = armarQuery(filtros);
  const respuesta = await fetch(`${API_BASE}/promos/mapa?${query}`);
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
