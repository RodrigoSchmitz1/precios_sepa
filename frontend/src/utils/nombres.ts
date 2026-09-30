/*
  Como se MUESTRAN las categorias y los rubros (2026-09-30).

  En los datos van sin tildes ni eñes ("Panales", "Azucar", "Te"): son la clave
  con la que se unen la clasificacion, los modelos de dbt y los historicos, y
  renombrarlas ahi obligaria a reescribir toda la historia acumulada. Asi que la
  clave queda como esta y solo cambia lo que se lee en pantalla.

  Todo lo que se manda a la API o se compara sigue usando la clave; estas
  funciones van unicamente en el punto donde el nombre se dibuja.
*/
const CATEGORIAS: Record<string, string> = {
  "Alimentos para bebe": "Alimentos para bebé",
  Azucar: "Azúcar",
  Cafe: "Café",
  "Dietetica suplementos y frutos secos": "Dietética, suplementos y frutos secos",
  "Facturas y reposteria": "Facturas y repostería",
  Ferreteria: "Ferretería",
  "Higiene bebe": "Higiene del bebé",
  Jugueteria: "Juguetería",
  Lavanderia: "Lavandería",
  Libreria: "Librería",
  Panales: "Pañales",
  "Papa y tuberculos": "Papa y tubérculos",
  Perfumeria: "Perfumería",
  Te: "Té",
};

const RUBROS: Record<string, string> = {
  Almacen: "Almacén",
  Bebes: "Bebés",
  "Infusiones y azucares": "Infusiones y azúcares",
  Lacteos: "Lácteos",
  Panaderia: "Panadería",
  "Verduleria y frutas": "Verdulería y frutas",
};

export function nombreCategoria(categoria: string): string {
  return CATEGORIAS[categoria] ?? categoria;
}

/** La gama, como se lee en una frase: "económico", no la clave "economico". */
export function nombreGama(gama: string): string {
  return gama === "economico" ? "económico" : gama;
}

export function nombreRubro(rubro: string): string {
  return RUBROS[rubro] ?? rubro;
}
