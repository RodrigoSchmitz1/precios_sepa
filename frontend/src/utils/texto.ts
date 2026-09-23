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
  const palabras = descripcion.toLowerCase().split(" ");
  const texto = palabras.map((palabra) => (deLaMarca.has(palabra) ? capitalizar(palabra) : palabra)).join(" ");

  /*
    Si la marca NO esta en la descripcion, se agrega al final (2026-09-23).

    Antes la marca solo servia para recapitalizar palabras que ya estaban, y si
    no aparecia se perdia. Es el caso de casi todo Dia: manda "REPELENT NARANJ
    AERO" con la marca "BONTE" en otro campo, "PAN ARABE CLASICO" con "DELIP".
    Medido sobre las promos de una zona de CABA: las 40 de Dia tenian marca y en
    ninguna estaba en la descripcion. Sin ella, "vino tinto" o "cerveza rubia"
    no dicen nada, porque el precio depende justamente de la marca.

    Se agrega solo si NINGUNA palabra significativa de la marca esta ya en la
    descripcion, para no duplicar "La Serenisima" cuando dice "SERENISIMA".
  */
  const significativas = [...deLaMarca].filter((p) => p.length > 2);
  const yaLaDice = significativas.some((p) => palabras.includes(p));
  const esMarcaDeVerdad = significativas.length > 0 && !NO_SON_MARCAS.has((marca ?? "").trim().toLowerCase());
  const conMarca = !yaLaDice && esMarcaDeVerdad ? `${texto} · ${marca!.trim().toLowerCase().split(/\s+/).map(capitalizar).join(" ")}` : texto;
  return capitalizar(conMarca);
}

/** Lo que algunas cadenas cargan en el campo de marca cuando no hay marca. */
const NO_SON_MARCAS = new Set(["sin marca", "s/m", "generico", "generica", "varios", "varias", "otros", "otras"]);
