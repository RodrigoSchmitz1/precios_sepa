/*
  La clave de un rubro en la direccion de su pagina de promos: "Verduleria y
  frutas" -> "verduleria-y-frutas" (openspec promos-navegables-y-mes-en-gastos).
  La misma cuenta que slug_rubro en api/mapa_promos.py; los tests de los dos
  lados usan los mismos ejemplos.
*/
export function slugRubro(rubro: string): string {
  return rubro
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** El nombre a mostrar cuando solo se tiene el slug (una categoria sin promos cerca). */
export function rubroDesdeSlug(slug: string): string {
  const texto = slug.replace(/-/g, " ");
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}
