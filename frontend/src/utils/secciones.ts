/*
  Las secciones del sitio, en un solo lugar: el menu de la computadora, la
  barra del celular y la hoja "Mas" leen de aca (openspec
  mis-gastos-y-barra-nueva).

  La barra del celular tiene cinco lugares. Desde app-para-el-usuario (2026-11-27):
  Promos, Buscar, el boton de cargar un ticket en el centro, Mi compra y Mis
  gastos. "Mas" paso arriba a la derecha, en lugar del carrito, que repetia Mi
  compra. Ver docs/DECISIONES.md.
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

/** La barra de abajo, en el celular: dos a cada lado del boton de ticket. */
export const BARRA_CELULAR: Seccion[] = [
  { ruta: "/", nombre: "Promos", corto: "Promos", icono: "🔥" },
  { ruta: "/mismo-producto", nombre: "Buscar", corto: "Buscar", icono: "🔎" },
  { ruta: "/lista", nombre: "Mi compra", corto: "Mi compra", icono: "🛒" },
  { ruta: "/gastos", nombre: "Mis gastos", corto: "Mis gastos", icono: "💸" },
];

/** Adonde lleva el boton central de la barra: cargar un gasto en Mis gastos. */
export const RUTA_CARGAR_TICKET = "/gastos?cargar=1";

/** Lo que abre "Mas" en el celular. */
export const MENU_MAS: Seccion[] = [
  { ruta: "/quien-gana", nombre: "Más barato", corto: "Barato", icono: "🏷️" },
  { ruta: "/inflacion", nombre: "Inflación", corto: "Inflación", icono: "📊" },
  { ruta: "/como-se-calcula", nombre: "Cómo se calcula", corto: "Cómo se calcula", icono: "ℹ️" },
  { ruta: "/privacidad", nombre: "Privacidad", corto: "Privacidad", icono: "🔒" },
];

/** "Mas" queda marcado cuando la pagina abierta es una de las suyas. */
export function rutaDeMas(pathname: string): boolean {
  return MENU_MAS.some((s) => pathname === s.ruta || pathname.startsWith(s.ruta + "/"));
}
