export type Promo = {
  descripcion: string;
  marca: string;
  categoria: string | null;
  rubro: string | null;
  cadena: string;
  provincia: string;
  precio_lista: number;
  precio_promo: number;
  descuento_pct: number;
  leyenda: string;
  sucursales_con_esta_promo: number;
};

export type PromoMapa = {
  descripcion: string;
  marca: string;
  categoria: string | null;
  rubro: string | null;
  cadena: string;
  nombre_sucursal: string;
  calle: string;
  numero: string;
  localidad: string;
  provincia: string;
  latitud: number;
  longitud: number;
  precio_lista: number;
  precio_promo: number;
  descuento_pct: number;
  leyenda: string;
};

export type QuienGana = {
  categoria: string;
  rubro: string;
  cadena: string;
  productos_ganados: number;
  total_productos_categoria: number;
  pct_victorias: number;
};

export type Canasta = {
  localidad: string;
  provincia: string;
  categorias_disponibles: number;
  costo_canasta_total: number;
};

export type Inflacion = {
  categoria: string;
  cadena: string;
  precio_inicio: number;
  precio_fin: number;
  variacion_pct: number;
  fecha_inicio: string;
  fecha_fin: string;
};
