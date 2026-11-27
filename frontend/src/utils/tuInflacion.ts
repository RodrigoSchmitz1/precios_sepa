/*
  Tu inflacion (openspec app-para-el-usuario): cuanto cambio lo que pagaste por
  tus mismos productos de un mes al otro, con los tickets guardados en el
  telefono. Es la version propia de la pagina de Inflacion y una de las cosas
  que gana el usuario por cargar tickets.

  Se compara contra la gondola de las MISMAS categorias, ponderada igual (la
  variacion que publica Inflacion), y no contra el INDEC, que el sitio no tiene.
*/
import type { Gasto, InflacionResumen } from "../types";
import { mesAnteriorDe, mesDe } from "./resumenGastos";

/** Con menos productos repetidos entre los dos meses, el numero es ruido. */
export const MINIMO_PRODUCTOS_INFLACION = 3;

type Precio = { nombre: string; categoria: string; importe: number; cantidad: number };

function preciosDelMes(gastos: Gasto[], mes: string): Map<string, Precio> {
  const precios = new Map<string, Precio>();
  for (const g of gastos) {
    if (g.origen !== "foto" || mesDe(g.fecha) !== mes) continue;
    for (const l of g.lineas) {
      if (!l.id_producto || l.importe <= 0 || l.cantidad <= 0) continue;
      const p = precios.get(l.id_producto) ?? { nombre: l.nombre ?? l.descripcion, categoria: l.categoria, importe: 0, cantidad: 0 };
      p.importe += l.importe;
      p.cantidad += l.cantidad;
      precios.set(l.id_producto, p);
    }
  }
  return precios;
}

export type ProductoQueCambio = { nombre: string; variacion: number };

export type TuInflacion =
  | { estado: "sin-datos"; comunes: number }
  | {
      estado: "ok";
      /** Fraccion: 0,018 es +1,8 %. */
      variacion: number;
      comunes: number;
      masSubio: ProductoQueCambio;
      masBajo: ProductoQueCambio;
      /** Pesos de cada categoria, para ponderar la gondola igual. */
      pesos: Map<string, number>;
    };

export function tuInflacion(gastos: Gasto[], mes: string): TuInflacion {
  const ahora = preciosDelMes(gastos, mes);
  const antes = preciosDelMes(gastos, mesAnteriorDe(mes));
  const comunes = [...ahora.keys()].filter((id) => antes.has(id));
  if (comunes.length < MINIMO_PRODUCTOS_INFLACION) return { estado: "sin-datos", comunes: comunes.length };
  const gastado = comunes.reduce((s, id) => s + ahora.get(id)!.importe, 0);
  let variacion = 0;
  const cambios: ProductoQueCambio[] = [];
  const pesos = new Map<string, number>();
  for (const id of comunes) {
    const a = ahora.get(id)!;
    const b = antes.get(id)!;
    const cambio = a.importe / a.cantidad / (b.importe / b.cantidad) - 1;
    const peso = a.importe / gastado;
    variacion += peso * cambio;
    cambios.push({ nombre: a.nombre, variacion: cambio });
    pesos.set(a.categoria, (pesos.get(a.categoria) ?? 0) + peso);
  }
  cambios.sort((x, y) => y.variacion - x.variacion);
  return { estado: "ok", variacion, comunes: comunes.length, masSubio: cambios[0], masBajo: cambios[cambios.length - 1], pesos };
}

/** La gondola de las mismas categorias, ponderada igual (fraccion), o null si no hay datos. */
export function gondolaPonderada(pesos: Map<string, number>, resumen: InflacionResumen[]): number | null {
  const porCategoria = new Map(resumen.map((r) => [r.categoria, r.variacion_pct / 100]));
  let suma = 0;
  let pesoUsado = 0;
  for (const [categoria, peso] of pesos) {
    const v = porCategoria.get(categoria);
    if (v === undefined) continue;
    suma += peso * v;
    pesoUsado += peso;
  }
  return pesoUsado > 0 ? suma / pesoUsado : null;
}
