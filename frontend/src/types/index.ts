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
  /** Comparables que ESTA cadena ofrece. Es el denominador correcto para medir
   *  precio: total_productos_categoria mide ademas amplitud de surtido. */
  productos_ofrecidos: number;
  total_productos_categoria: number;
  /** ganados / ofrecidos: cuando la cadena tiene el producto, cuan seguido es
   *  la mas barata. Es la tasa por la que se ordena. */
  pct_gana_cuando_compite: number;
  /** ganados / total comparables. Se conserva por continuidad del historico,
   *  pero mezcla precio con surtido: no usar para rankear. */
  pct_victorias: number;
};

export type Canasta = {
  localidad: string;
  provincia: string;
  categorias_en_canasta: number;
  costo_canasta_total: number;
};

export type Inflacion = {
  categoria: string;
  cadena: string;
  /** Parte del grano: una cadena puede aparecer dos veces en la misma categoria
   *  con unidades distintas (ej. jugos en cc y en unidad). */
  unidad_normalizada: string;
  /** Nivel de precios observado en la fecha final. Es un dato de contexto: no
   *  guarda relacion aritmetica con variacion_pct, que se mide encadenando los
   *  cambios diarios sobre productos pareados y no restando dos niveles. */
  precio_actual: number;
  variacion_pct: number;
  fecha_inicio: string;
  fecha_fin: string;
};

export type ItemCanastaIA = {
  categoria: string;
  cantidad: number;
  unidad: string;
  gama: string;
  razon: string;
};

export type ItemCanastaCalculado = ItemCanastaIA & {
  precio_unitario: number;
  costo_categoria: number;
  muestras: number;
};

export type ResultadoCanastaPersonalizada = {
  items: ItemCanastaCalculado[];
  costo_total: number;
  categorias_calculadas: number;
  categorias_pedidas: number;
};

export type LocalidadOpcion = {
  localidad: string;
  provincia: string;
};
