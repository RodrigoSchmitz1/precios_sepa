import type { Zona } from "../utils/zona";
import type {
  RenglonInterpretado,
  Promo,
  PromoMapa,
  LugarMapa,
  SucursalMapa,
  QuienGana,
  GrupoComposicion,
  Inflacion,
  InflacionResumen,
  IncidenciaCanasta,
  AhorroPorCategoria,
  ItemCanastaIA,
  ResultadoCanastaPersonalizada,
  LocalidadOpcion,
  CanastaPorCadena,
  CategoriaCanasta,
  ProductoComparado,
  ProductoDetalle,
  ProductoSugerido,
  PromoCerca,
  ResultadoLista,
  ResultadoOptimizacion, PromosDeLista, Basico } from "../types";
import { conNombresDeCadena } from "../utils/nombres";
import type { CadenasDeOtroDia } from "../utils/cadenasDeOtroDia";

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
/** El cuerpo de una respuesta, con los nombres de cadena como se muestran. */
async function leerJson(respuesta: Response) {
  return conNombresDeCadena(await respuesta.json());
}

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
  /** Cada sucursal nombrada por alguna promo, una sola vez, por numero. */
  sucursales: Record<string, SucursalMapa>;
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
  return leerJson(respuesta);
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
  return leerJson(respuesta);
}

/*
  La lista entera de localidades y barrios, una sola vez: pesa unas decenas de
  KB y el buscador la filtra al tipear sin volver a pedir nada.
*/
export async function obtenerLugares(): Promise<LugarMapa[]> {
  const respuesta = await fetch(`${API_BASE}/promos/lugares`);
  if (!respuesta.ok) await fallar(respuesta, "Error al traer las localidades");
  return leerJson(respuesta);
}

/*
  Los lugares que se pueden elegir como zona, con sus cadenas (zona compartida,
  2026-11). Una sola vez, como los lugares del mapa.
*/
export async function obtenerZonas(): Promise<Zona[]> {
  const respuesta = await fetch(`${API_BASE}/zonas`);
  if (!respuesta.ok) await fallar(respuesta, "Error al traer las zonas");
  return leerJson(respuesta);
}

/** Quien gana en cada categoria contando solo las cadenas de la zona. Van los
 *  nombres crudos de la API (Zona.cadenas), no los que se muestran. */
export async function obtenerQuienGanaZona(cadenas: string[]): Promise<QuienGana[]> {
  const params = new URLSearchParams();
  for (const cadena of cadenas) params.append("cadenas", cadena);
  const respuesta = await fetch(`${API_BASE}/quien-gana/zona?${params.toString()}`);
  if (!respuesta.ok) await fallar(respuesta, "Error al traer quién gana en tu zona");
  return leerJson(respuesta);
}

export async function obtenerQuienGana(categoria: string): Promise<QuienGana[]> {
  const params = new URLSearchParams();
  if (categoria) params.set("categoria", categoria);
  const respuesta = await fetch(`${API_BASE}/quien-gana?${params.toString()}`);
  if (!respuesta.ok) await fallar(respuesta, "Error al traer quién gana");
  return leerJson(respuesta);
}

/** Las cadenas que hoy se muestran con precios de otro dia (SEPA no las
 *  publico en el ultimo). Vacia en un dia completo. */
export async function obtenerCadenasDeOtroDia(): Promise<CadenasDeOtroDia> {
  const respuesta = await fetch(`${API_BASE}/datos/cadenas-de-otro-dia`);
  if (!respuesta.ok) await fallar(respuesta, "Error al traer las cadenas de otro día");
  return leerJson(respuesta);
}

// obtenerCategoriasDisponibles se elimino el 2026-09-11: la pagina trae el mart
// entero de una vez y saca la lista de categorias de ahi, asi que ese endpoint
// era una consulta a BigQuery para un dato que ya estaba en el navegador.

export async function obtenerComposicionCanasta(): Promise<GrupoComposicion[]> {
  const respuesta = await fetch(`${API_BASE}/canasta/composicion`);
  if (!respuesta.ok) await fallar(respuesta, "Error al traer la composición");
  return leerJson(respuesta);
}

/** mes: "AAAA-MM"; sin mes, el ultimo con datos. */
export async function obtenerInflacionResumen(mes?: string): Promise<InflacionResumen[]> {
  const params = new URLSearchParams();
  if (mes) params.set("mes", mes);
  const respuesta = await fetch(`${API_BASE}/inflacion/resumen?${params.toString()}`);
  if (!respuesta.ok) await fallar(respuesta, "Error al traer el resumen");
  return leerJson(respuesta);
}

export async function obtenerAhorroPorCategoria(): Promise<AhorroPorCategoria> {
  const respuesta = await fetch(`${API_BASE}/mismo-producto/ahorro`);
  if (!respuesta.ok) await fallar(respuesta, "Error al traer el ahorro por categoría");
  return leerJson(respuesta);
}

/** mes: "AAAA-MM"; sin mes, el ultimo con datos. Null si no hay periodo. */
export async function obtenerIncidenciaCanasta(mes?: string): Promise<IncidenciaCanasta | null> {
  const params = new URLSearchParams();
  if (mes) params.set("mes", mes);
  const respuesta = await fetch(`${API_BASE}/inflacion/incidencia?${params.toString()}`);
  if (!respuesta.ok) await fallar(respuesta, "Error al traer la incidencia");
  return leerJson(respuesta);
}

export async function obtenerInflacion(categoria: string, mes?: string): Promise<Inflacion[]> {
  const params = new URLSearchParams();
  if (categoria) params.set("categoria", categoria);
  if (mes) params.set("mes", mes);
  const respuesta = await fetch(`${API_BASE}/inflacion?${params.toString()}`);
  if (!respuesta.ok) await fallar(respuesta, "Error al traer inflación");
  return leerJson(respuesta);
}

export async function interpretarCanasta(descripcion: string): Promise<{ items: ItemCanastaIA[] }> {
  const respuesta = await fetch(`${API_BASE}/canasta-personalizada/interpretar`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ descripcion }),
  });
  if (!respuesta.ok) await fallar(respuesta, "Error al interpretar");
  return leerJson(respuesta);
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
  return leerJson(respuesta);
}

export async function buscarLocalidades(busqueda: string): Promise<LocalidadOpcion[]> {
  const params = new URLSearchParams();
  if (busqueda.trim()) params.set("busqueda", busqueda.trim());
  const respuesta = await fetch(`${API_BASE}/canasta-personalizada/localidades?${params.toString()}`);
  if (!respuesta.ok) await fallar(respuesta, "Error al buscar localidades");
  return leerJson(respuesta);
}

export async function obtenerCategoriasCanasta(): Promise<CategoriaCanasta[]> {
  const respuesta = await fetch(`${API_BASE}/canasta-personalizada/categorias`);
  if (!respuesta.ok) await fallar(respuesta, "Error al traer las categorías");
  return leerJson(respuesta);
}

export async function buscarProductos(consulta: string): Promise<ProductoComparado[]> {
  const params = new URLSearchParams({ q: consulta.trim() });
  const respuesta = await fetch(`${API_BASE}/mismo-producto/buscar?${params.toString()}`);
  if (!respuesta.ok) await fallar(respuesta, "Error al buscar productos");
  return leerJson(respuesta);
}

export async function obtenerProductosDestacados(): Promise<ProductoComparado[]> {
  const respuesta = await fetch(`${API_BASE}/mismo-producto/destacados`);
  if (!respuesta.ok) await fallar(respuesta, "Error al traer los destacados");
  return leerJson(respuesta);
}

/** Tu lista: cuanto sale una lista de productos exactos en cada cadena. */
/** Con `cadenas` (los nombres crudos de Zona.cadenas, como en
 *  obtenerQuienGanaZona) la respuesta suma el bloque "zona". */
export async function cotizarLista(
  items: { id_producto: string; cantidad: number }[],
  cadenas?: string[],
): Promise<ResultadoLista> {
  const respuesta = await fetch(`${API_BASE}/mismo-producto/lista`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(cadenas && cadenas.length > 0 ? { items, cadenas } : { items }),
  });
  if (!respuesta.ok) await fallar(respuesta, "Error al cotizar tu lista");
  return leerJson(respuesta);
}

/** Las promos vigentes de unos productos cerca de la zona, por id_producto
 *  (openspec promos-de-tu-lista). Solo trae los productos que tienen alguna. */
export async function obtenerPromosDeProductos(
  ids: string[],
  zona: Pick<Zona, "latitud" | "longitud">,
): Promise<Record<string, PromoCerca[]>> {
  const parametros = new URLSearchParams({
    ids: ids.join(","),
    latitud: String(zona.latitud),
    longitud: String(zona.longitud),
  });
  const respuesta = await fetch(`${API_BASE}/promos/productos?${parametros}`);
  if (!respuesta.ok) await fallar(respuesta, "Error al traer las promos");
  return (await leerJson(respuesta)).promos;
}

/** Cuanto sale Tu lista en cada cadena cerca con sus promos, en una sola
 *  sucursal por cadena (openspec total-con-promos-cerca). */
export async function obtenerPromosDeLista(
  items: { id_producto: string; cantidad: number }[],
  zona: Pick<Zona, "latitud" | "longitud" | "cadenas">,
): Promise<PromosDeLista> {
  const respuesta = await fetch(`${API_BASE}/promos/lista`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ items, cadenas: zona.cadenas, latitud: zona.latitud, longitud: zona.longitud }),
  });
  if (!respuesta.ok) await fallar(respuesta, "Error al calcular la lista con promos");
  return leerJson(respuesta);
}

/** Los basicos del armado rapido de Tu lista (openspec lista-en-el-centro). */
/** Una lista escrita (la de un chat) convertida en productos, un renglon por
 *  producto (openspec compartir-y-pegar-la-lista). */
export async function interpretarLista(texto: string): Promise<RenglonInterpretado[]> {
  const respuesta = await fetch(`${API_BASE}/mismo-producto/interpretar`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ texto }),
  });
  if (!respuesta.ok) await fallar(respuesta, "Error al leer la lista");
  return leerJson(respuesta);
}

export async function obtenerBasicos(): Promise<Basico[]> {
  const respuesta = await fetch(`${API_BASE}/mismo-producto/basicos`);
  if (!respuesta.ok) await fallar(respuesta, "Error al traer los básicos");
  return leerJson(respuesta);
}

/** De tu canasta a tu lista: los productos mas comunes de cada categoria. */
export async function obtenerSugeridos(categorias: string[], limite: number): Promise<Record<string, ProductoSugerido[]>> {
  const respuesta = await fetch(`${API_BASE}/mismo-producto/sugeridos`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ categorias, limite }),
  });
  if (!respuesta.ok) await fallar(respuesta, "Error al traer los productos de tu canasta");
  return leerJson(respuesta);
}

export async function obtenerProducto(idProducto: string): Promise<ProductoDetalle> {
  const respuesta = await fetch(`${API_BASE}/mismo-producto/${encodeURIComponent(idProducto)}`);
  if (!respuesta.ok) await fallar(respuesta, "Error al traer el producto");
  return leerJson(respuesta);
}

/** Tu canasta en cada cadena: cuanto sale la compra entera en cada una. */
export async function cotizarCanastaPorCadena(
  items: ItemCanastaIA[],
  localidades: LocalidadOpcion[]
): Promise<CanastaPorCadena> {
  const respuesta = await fetch(`${API_BASE}/canasta-personalizada/por-cadena`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ items, localidades }),
  });
  if (!respuesta.ok) await fallar(respuesta, "Error al comparar las cadenas");
  return leerJson(respuesta);
}

export async function optimizarCompra(
  items: ItemCanastaIA[],
  latitud: number,
  longitud: number,
  radioKm: number
): Promise<ResultadoOptimizacion> {
  const respuesta = await fetch(`${API_BASE}/canasta-personalizada/optimizar`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ items, latitud, longitud, radio_km: radioKm }),
  });
  if (!respuesta.ok) await fallar(respuesta, "Error al optimizar la compra");
  return leerJson(respuesta);
}
