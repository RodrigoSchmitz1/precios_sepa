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
  /** Con que evidencia se sostiene el descuento. Ver mart_promos_evidencia. */
  nivel_evidencia: "leyenda" | "mercado" | "sin_verificar";
  /** En cuantas provincias rige esta promo AL MISMO PRECIO. La API agrupa por
   *  precio, asi que si en otra provincia cuesta distinto es otra fila. */
  provincias: number;
};

/** Una sucursal del mapa. La respuesta las trae una sola vez, por numero. */
export type SucursalMapa = {
  cadena: string;
  nombre_sucursal: string;
  calle: string;
  numero: string;
  barrio: string | null;
  localidad: string;
  provincia: string;
  latitud: number;
  longitud: number;
};

/** Una localidad o barrio al que el buscador de arriba del mapa puede llevar. */
export type LugarMapa = {
  nombre: string;
  provincia: string | null;
  latitud: number;
  longitud: number;
  /** Sucursales con datos en ese lugar: ordena las sugerencias. */
  sucursales: number;
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
  nivel_evidencia: "leyenda" | "mercado" | "sin_verificar";
  /** Numeros de TODAS las sucursales de la zona donde rige. Los datos de cada
   *  una estan en la tabla "sucursales" de la respuesta. */
  sucursales: number[];
  total_sucursales: number;
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

export type InflacionResumen = {
  categoria: string;
  /** Variacion del mercado: media geometrica de los factores encadenados de
   *  todas las series (cadena x unidad) de la categoria. Sin datos de volumen
   *  de ventas no hay con qué ponderar, asi que cada cadena pesa igual. */
  variacion_pct: number;
  /** Sobre cuantas series y cuantas cadenas se calculo. Se muestran para que el
   *  lector pueda pesar un -2,9% sobre 7 cadenas contra uno sobre 14. */
  series: number;
  /** Cadenas del dia con menos cobertura: "al menos N cadenas todos los dias". */
  cadenas: number;
  /** La variacion es de un mes calendario (2026-10-27). Primer dia del mes. */
  mes: string;
  /** Falso si un hueco en los datos corto la serie despues del primero del
   *  mes: entonces el periodo arranca en fecha_inicio y no en el mes anterior. */
  desde_inicio_de_mes: boolean;
  fecha_inicio: string;
  fecha_fin: string;
};

/** Como fija sus precios una bandera respecto de su hermana de la misma empresa. */
export type ReglaDePrecio = {
  cadena: string;
  referencia: string;
  /** Productos que venden las dos. */
  productos: number;
  pct_mas_barata: number;
  pct_igual: number;
  pct_mas_cara: number;
  /** Los descuentos mas comunes, en puntos enteros, sobre todos los productos. */
  escalones: { descuento_pct: number; pct_productos: number }[];
};

/** Cuanto conviene comparar: ahorro tipico por categoria y quien es mas barato. */
export type AhorroPorCategoria = {
  productos: number;
  /** Mediana del ahorro contra el precio tipico; null si no hay comparables. */
  ahorro_mediano_pct: number | null;
  categorias: {
    categoria: string;
    productos: number;
    ahorro_mediano_pct: number;
    cadena_mas_barata: string;
    pct_mas_barata: number;
  }[];
  mas_baratas: { cadena: string; productos: number; pct: number }[];
  reglas: ReglaDePrecio[];
  fecha_datos?: string;
};

/** Cuanto aporta cada categoria de la canasta basica a su variacion en el mes. */
export type IncidenciaCanasta = {
  mes: string;
  fecha_inicio: string;
  fecha_fin: string;
  desde_inicio_de_mes: boolean;
  /** Nula si ninguna categoria de la canasta se pudo encadenar en el mes. */
  variacion_canasta_pct: number | null;
  /** Que parte del gasto de la canasta tiene indice. Bajo 100, la variacion es
   *  la de esa parte, no la de la canasta entera. */
  cobertura_pct: number;
  categorias: {
    categoria: string;
    peso_pct: number;
    variacion_pct: number;
    /** Puntos de la variacion de la canasta; suman variacion_canasta_pct. */
    incidencia_pp: number;
    cadenas: number;
  }[];
  sin_indice: string[];
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
  precio_actual: number | null;
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
  /** "provincia" cuando la zona elegida no junta datos de la categoria y se
   *  uso el precio de su provincia. Opcional por compatibilidad con la API
   *  anterior, que no lo mandaba. */
  origen_precio?: "zona" | "provincia";
};

export type ResultadoCanastaPersonalizada = {
  items: ItemCanastaCalculado[];
  costo_total: number;
  categorias_calculadas: number;
  categorias_pedidas: number;
  categorias_provinciales?: number;
};

/** Que tiene la canasta basica, agrupado para mostrar. Cantidades por adulto
 *  equivalente y por mes, como las publica el INDEC. */
export type GrupoComposicion = {
  grupo: string;
  items: { categoria: string; cantidad: number; unidad: "g" | "cc" | "unidad" }[];
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
  /** Empresas distintas, que no es lo mismo que cadenas: Carrefour tiene cuatro
   *  banderas. Es lo que decide si un producto puede destacarse. */
  empresas: number;
  /** Extremos entre las medianas de cada cadena, no entre sucursales sueltas. */
  precio_mas_bajo: number;
  precio_mas_alto: number;
  diferencia_pct: number;
  /** Tamano del envase normalizado a g, cc o unidades. null si la fuente no
   *  trae una unidad reconocible o si el mart todavia no tiene la columna. */
  cantidad_normalizada: number | null;
  unidad_normalizada: "g" | "cc" | "unidad" | null;
  /** Cuantos precios se dejaron fuera del calculo por contradecir al mercado. */
  cadenas_descartadas: number;
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
  /** false cuando el precio esta a menos de la mitad o a mas del doble de la
   *  mediana entre empresas y ninguna otra cadena lo confirma. Se muestra
   *  igual, marcado, pero no cuenta para la brecha del producto. */
  precio_creible: boolean;
};

export type ProductoDetalle = ProductoComparado & {
  fecha_datos: string;
  /** Mediana entre empresas contra la que se juzga cada precio. Null con menos
   *  de 3 empresas, donde no se juzga a nadie. */
  precio_referencia?: number | null;
  /** De menor a mayor precio. */
  precios: PrecioEnCadena[];
};

/*
  Optimizacion de la compra entre sucursales cercanas (Fase 4).
  La distancia viaja para informar, no para ponderar: no se le pone precio a un
  kilometro, porque no sabemos como se mueve cada persona.
*/

/** Un item de la canasta ya asignado a una sucursal. */
export type ItemComprado = {
  categoria: string;
  gama: string;
  unidad: string;
  cantidad: number;
  precio_unitario: number;
  costo: number;
};

export type SucursalOpcion = {
  id: string;
  cadena: string;
  nombre_sucursal: string;
  direccion: string | null;
  localidad: string;
  provincia: string;
  latitud: number;
  longitud: number;
  distancia_km: number;
  /** Cuantas otras sucursales de la zona tienen exactamente los mismos precios:
   *  sin esto, la elegida parece unica cuando hay varias iguales. */
  equivalentes: number;
  subtotal: number;
  items: ItemComprado[];
};

export type OpcionCompra = {
  /** 1, 2 o 3: en cuantas sucursales se divide la compra. */
  max_sucursales: number;
  total: number;
  items_cubiertos: number;
  distancia_suma_km: number;
  sucursales: SucursalOpcion[];
};

export type ResultadoOptimizacion = {
  fecha_datos: string;
  radio_km: number;
  sucursales_en_zona: number;
  sucursales_candidatas: number;
  items_sin_precio: { categoria: string; gama: string; unidad: string }[];
  opciones: OpcionCompra[];
};

/** Un producto de Tu lista, como se guarda en el navegador. */
export type ItemLista = {
  id_producto: string;
  /** El nombre legible al momento de agregarlo, para mostrar la lista sin
   *  esperar a la API. */
  nombre: string;
  cantidad: number;
  /** La categoria, para saber que ya se eligio la marca de esa categoria de Tu
   *  canasta. Opcional: las listas guardadas antes no la tienen. */
  categoria?: string | null;
};

/** Tu canasta en cada cadena (POST /canasta-personalizada/por-cadena). */
export type CanastaPorCadena = {
  /** "zona" si se usaron solo las sucursales de las localidades elegidas. */
  ambito: "zona" | "pais";
  cadenas: { cadena: string; total: number; con_otra_gama: number; sucursales: number }[];
  /** Las categorias que venden todas las cadenas comparadas: sobre ellas se suma. */
  categorias_comparadas: string[];
  categorias_afuera: string[];
  /** Cadenas que no venden lo suficiente de la canasta para comparar parejo. */
  cadenas_afuera: { cadena: string; categorias_con_precio: number }[];
  total_categorias: number;
  fecha_datos: string | null;
};

/** Un producto comun de una categoria, para elegir la marca desde Tu canasta. */
export type ProductoSugerido = ProductoComparado & {
  /** Sucursales con precio creible, sumando todas las cadenas. */
  sucursales: number;
};

/** Cuanto sale Tu lista en una cadena. */
export type TotalCadenaLista = {
  cadena: string;
  total: number;
  productos_con_precio: number;
  /** Tiene precio de todos los productos de la lista: solo los totales de
   *  cadenas completas se comparan entre si. */
  completa: boolean;
  faltan: string[];
};

export type ResultadoLista = {
  productos: (ProductoComparado & { cantidad: number; mas_barato: { cadena: string; precio: number } })[];
  no_encontrados: string[];
  cadenas: TotalCadenaLista[];
  /** Cada producto en la cadena donde esta mas barato: el piso, yendo a varias. */
  combinando_cadenas: number;
  fecha_datos: string | null;
};
