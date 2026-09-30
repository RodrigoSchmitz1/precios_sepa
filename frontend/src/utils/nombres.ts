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

/*
  Las cadenas, como las escribe cada marca. SEPA las informa sin tilde ("La
  Anonima", "Changomas", "Dia") y asi quedan en los datos, donde el nombre es
  parte de la clave de cada serie historica.
*/
const CADENAS: Record<string, string> = {
  "La Anonima": "La Anónima",
  "Topsy (La Anonima)": "Topsy (La Anónima)",
  "Bomba (La Anonima)": "Bomba (La Anónima)",
  Changomas: "Changomás",
  SuperChangomas: "SuperChangomás",
  HiperChangomas: "HiperChangomás",
  Dia: "Día",
};

export function nombreCadena(cadena: string): string {
  return CADENAS[cadena] ?? cadena;
}

/**
 * Devuelve la respuesta de la API con los nombres de cadena ya escritos como
 * se muestran. Va en un solo lugar (api/client.ts) y no en cada pantalla: las
 * cadenas se dibujan en mas de veinte puntos y en frases armadas con listas,
 * y el frontend nunca le devuelve un nombre de cadena a la API, asi que no hay
 * clave que cuidar de este lado.
 */
export function conNombresDeCadena<T>(datos: T): T {
  if (Array.isArray(datos)) {
    for (const elemento of datos) conNombresDeCadena(elemento);
  } else if (datos !== null && typeof datos === "object") {
    const objeto = datos as Record<string, unknown>;
    for (const clave of Object.keys(objeto)) {
      const valor = objeto[clave];
      if (clave === "cadena" && typeof valor === "string") objeto[clave] = nombreCadena(valor);
      else if (valor !== null && typeof valor === "object") conNombresDeCadena(valor);
    }
  }
  return datos;
}
