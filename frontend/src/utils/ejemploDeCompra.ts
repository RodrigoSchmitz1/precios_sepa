/*
  La compra de ejemplo (openspec ejemplo-para-empezar): la primera vez que se
  abre la app, Mi compra arranca con unos 12 basicos reales para que se vea
  enseguida cuanto sale en cada cadena de la zona. Es una lista comun con una
  marca aparte: "activo" mientras la lista sea el ejemplo y "hecho" cuando ya
  se cargo una vez (asi no vuelve nunca).
*/
import type { Basico, ItemLista } from "../types";
import { nombreParaLista } from "./nombreParaLista";

const CLAVE_MARCA = "changuito.lista.ejemplo.v1";

/** Cuantos basicos por grupo: con seis grupos, una compra de 12 productos. */
export const POR_GRUPO_DEL_EJEMPLO = 2;

/** Con menos de estos, el ejemplo no muestra una compra creible y no se carga. */
export const MINIMO_DEL_EJEMPLO = 8;

/** Cuanto tiempo se ofrece "Deshacer" despues de que un producto propio reemplaza al ejemplo (app-para-el-usuario). */
export const SEGUNDOS_PARA_DESHACER = 6;

export type MarcaEjemplo = "activo" | "hecho" | null;

export function leerMarcaEjemplo(): MarcaEjemplo {
  try {
    const valor = window.localStorage.getItem(CLAVE_MARCA);
    return valor === "activo" || valor === "hecho" ? valor : null;
  } catch {
    return null;
  }
}

export function guardarMarcaEjemplo(marca: Exclude<MarcaEjemplo, null>): void {
  try {
    window.localStorage.setItem(CLAVE_MARCA, marca);
  } catch {
    /* sin persistencia, en la proxima visita se ofrece de nuevo: no rompe nada */
  }
}

/**
 * Los items del ejemplo: en cada grupo, los basicos que venden mas empresas.
 * Un producto que tienen pocas cadenas deja a casi todas "sin la compra
 * completa" y la comparacion queda entre dos banderas hermanas. Vacio si no
 * alcanzan.
 */
export function elegirEjemplo(basicos: Basico[]): ItemLista[] {
  const grupos = [...new Set(basicos.map((b) => b.grupo))];
  const items: ItemLista[] = [];
  for (const grupo of grupos) {
    const delGrupo = basicos
      .map((b, orden) => ({ b, orden }))
      .filter(({ b }) => b.grupo === grupo)
      .sort((x, y) => (y.b.producto.empresas ?? 0) - (x.b.producto.empresas ?? 0) || x.orden - y.orden);
    let puestos = 0;
    for (const { b } of delGrupo) {
      if (puestos >= POR_GRUPO_DEL_EJEMPLO) break;
      if (items.some((i) => i.id_producto === b.producto.id_producto)) continue;
      items.push({
        id_producto: b.producto.id_producto,
        nombre: nombreParaLista(b.producto),
        cantidad: 1,
        categoria: b.producto.categoria,
        grupo: b.grupo,
      });
      puestos++;
    }
  }
  return items.length >= MINIMO_DEL_EJEMPLO ? items : [];
}

/** Los grupos presentes en la lista, en orden de aparicion. */
export function gruposDeLista(lista: ItemLista[]): string[] {
  return [...new Set(lista.map((i) => i.grupo).filter((g): g is string => !!g))];
}
