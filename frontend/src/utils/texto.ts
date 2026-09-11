/*
  Normalizacion de texto para buscar: minusculas y sin tildes.

  Las localidades y las categorias vienen escritas de las dos formas ("San
  Martín", "Panales"), y nadie tipea los acentos igual que la fuente. Estaba
  duplicada en cada buscador; vive aca para que todos busquen igual.
*/
export function normalizar(texto: string): string {
  return texto.normalize("NFD").replace(/\p{Mn}/gu, "").toLowerCase();
}
