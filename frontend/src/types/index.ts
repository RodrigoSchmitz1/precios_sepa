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
  /** Categorias valuadas con la mediana de la provincia porque la localidad no
   *  junta suficientes observaciones. Como mucho 2 de las 32. */
  categorias_imputadas: number;
  costo_canasta_total: number;
};

export type InflacionResumen = {
  categoria: string;
  /** Variacion del mercado: media geometrica de los factores encadenados de
   *  todas las series (cadena x unidad) de la categoria. Sin datos de volumen
   *  de ventas no hay con que ponderar, asi que cada cadena pesa igual. */
  variacion_pct: number;
  /** Sobre cuantas series y cuantas cadenas se calculo. Se muestran para que el
   *  lector pueda pesar un -2,9% sobre 7 cadenas contra uno sobre 14. */
  series: number;
  cadenas: number;
  fecha_inicio: string;
  fecha_fin: string;
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

/** Categoria que se puede agregar a mano a Tu canasta. */
export type CategoriaCanasta = {
  categoria: string;
  /** Unidad en la que se cotiza: "g", "cc" o "unidad". */
  unidad: string;
  cantidad_sugerida: number;
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

/** Una linea del desglose de la canasta de una localidad. */
export type CanastaDetalle = {
  categoria: string;
  cantidad_necesaria: number;
  precio_mediano_unidad: number;
  costo_categoria: number;
  /** Observaciones de precio sobre las que se calculo la mediana. Se muestra
   *  para que el lector pueda juzgar cuan firme es cada linea. */
  muestras: number;
  /** "provincia" cuando la localidad no junta 6 observaciones de la categoria y
   *  se usa la mediana provincial; en ese caso muestras es la de la provincia. */
  origen_precio: "localidad" | "provincia";
};

export type LocalidadOpcion = {
  localidad: string;
  provincia: string;
};

/** Un producto con precio en dos o mas cadenas, para el buscador y las listas. */
export type ProductoComparado = {
  /** Codigo de barras, como texto: los ceros a la izquierda importan. */
  id_producto: string;
  descripcion: string;
  marca: string | null;
  categoria: string | null;
  cadenas: number;
  /** Extremos entre las medianas de cada cadena, no entre sucursales sueltas. */
  precio_mas_bajo: number;
  precio_mas_alto: number;
  diferencia_pct: number;
  /** Si el precio mas bajo y el mas alto salen de 3 o mas sucursales. Sin eso
   *  la diferencia puede depender de un precio mal cargado: se muestra, pero no
   *  se destaca. */
  extremos_respaldados: boolean;
};

export type PrecioEnCadena = {
  cadena: string;
  /** Mediana entre las sucursales de la cadena. */
  precio_mediano: number;
  precio_minimo: number;
  precio_maximo: number;
  sucursales: number;
};

export type ProductoDetalle = ProductoComparado & {
  fecha_datos: string;
  /** De menor a mayor precio. */
  precios: PrecioEnCadena[];
};
