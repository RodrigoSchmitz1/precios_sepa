/*
  Las secciones del sitio, en un solo lugar: el menu de la computadora, la
  barra del celular y la hoja "Mas" leen de aca (openspec
  mis-gastos-y-barra-nueva).

  La barra del celular tiene cinco lugares. Desde 2026-11-22: Promos, Buscar
  (Mismo producto, adonde lleva el buscador), Mi compra, Mis gastos y Mas. Mas
  barato paso a "Mas": repite lo que ya dice la tarjeta principal de la
  portada. Tu canasta se unio con Mi lista en Mi compra (openspec mi-compra).
  Ver docs/DECISIONES.md.
*/

export type Seccion = { ruta: string; nombre: string; corto: string; icono: string };

/** El menu de arriba, en la computadora: todas las secciones. */
export const SECCIONES: Seccion[] = [
  { ruta: "/", nombre: "Promos", corto: "Promos", icono: "🔥" },
  { ruta: "/mismo-producto", nombre: "Mismo producto", corto: "Buscar", icono: "🔎" },
  { ruta: "/lista", nombre: "Mi compra", corto: "Mi compra", icono: "🛒" },
  { ruta: "/gastos", nombre: "Mis gastos", corto: "Mis gastos", icono: "💸" },
  { ruta: "/quien-gana", nombre: "Más barato", corto: "Barato", icono: "🏷️" },
  { ruta: "/inflacion", nombre: "Inflación", corto: "Inflación", icono: "📊" },
];

/** La barra de abajo, en el celular. "Mas" no es una ruta: abre la hoja. */
export const BARRA_CELULAR: Seccion[] = [
  { ruta: "/", nombre: "Promos", corto: "Promos", icono: "🔥" },
  { ruta: "/mismo-producto", nombre: "Buscar", corto: "Buscar", icono: "🔎" },
  { ruta: "/lista", nombre: "Mi compra", corto: "Mi compra", icono: "🛒" },
  { ruta: "/gastos", nombre: "Mis gastos", corto: "Mis gastos", icono: "💸" },
];

/** Lo que abre "Mas" en el celular. */
export const MENU_MAS: Seccion[] = [
  { ruta: "/quien-gana", nombre: "Más barato", corto: "Barato", icono: "🏷️" },
  { ruta: "/inflacion", nombre: "Inflación", corto: "Inflación", icono: "📊" },
  { ruta: "/como-se-calcula", nombre: "Cómo se calcula", corto: "Cómo se calcula", icono: "ℹ️" },
];

/** "Mas" queda marcado cuando la pagina abierta es una de las suyas. */
export function rutaDeMas(pathname: string): boolean {
  return MENU_MAS.some((s) => pathname === s.ruta || pathname.startsWith(s.ruta + "/"));
}
