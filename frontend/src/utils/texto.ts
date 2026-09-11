/*
  Normalizacion de texto para buscar: minusculas y sin tildes.

  Las localidades y las categorias vienen escritas de las dos formas ("San
  Martín", "Panales"), y nadie tipea los acentos igual que la fuente. Estaba
  duplicada en cada buscador; vive aca para que todos busquen igual.
*/
export function normalizar(texto: string): string {
  return texto.normalize("NFD").replace(/\p{Mn}/gu, "").toLowerCase();
}

/*
  SEPA escribe las descripciones en mayusculas ("YERBA MATE PLAYADITO 1 KG").
  En un titular grande eso grita, asi que se pasan a minuscula con la inicial en
  mayuscula, y las palabras de la marca recuperan la suya para que no quede
  "playadito".

  Se compara palabra por palabra en vez de armar una expresion regular con la
  marca adentro: hay marcas con caracteres que la expresion interpretaria
  ("L OREAL", "M&M'S") y escaparlas era una fuente de errores sin ninguna
  ventaja.
*/
export function nombreLegible(descripcion: string, marca: string | null): string {
  const capitalizar = (palabra: string) => palabra.charAt(0).toUpperCase() + palabra.slice(1);
  const deLaMarca = new Set(
    (marca ?? "")
      .toLowerCase()
      .split(/\s+/)
      .filter((p) => p.length > 1)
  );
  const texto = descripcion
    .toLowerCase()
    .split(" ")
    .map((palabra) => (deLaMarca.has(palabra) ? capitalizar(palabra) : palabra))
    .join(" ");
  return capitalizar(texto);
}
