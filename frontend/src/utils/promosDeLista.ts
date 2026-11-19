import type { PromosDeLista } from "../types";
import { formatearPesos } from "./formato";
import { nombreCadena } from "./nombres";
import { direccionPromo, textoVigencia } from "./promosCerca";
import { listarConY } from "./texto";

/*
  El total de Tu lista con las promos cerca (openspec total-con-promos-cerca,
  2026-11-19).

  El total de siempre sigue con precios de lista: no todas las cadenas informan
  promos (Día 960 por sucursal, Coto 33, Vea, Disco, Jumbo y los Changomás
  cero), y meterlas ahí haría ganar a la que más informa. Pero medido sobre 200
  listas en 60 zonas, con las promos de una sola sucursal la cadena más barata
  cambia en la mitad de las listas. Por eso va una línea aparte, que nombra a
  las que casi no informan.
*/

/** El total de siempre: la cadena más barata de la zona a precio de lista. */
export type GanadorDeLista = { cadena: string; total: number };

export type LineaPromos = { texto: string; cambia: boolean; aviso: string };

/** La baja mínima para decir algo cuando gana la misma cadena. */
const BAJA_MINIMA = 0.01;

export function lineaPromosDeLista(datos: PromosDeLista | null | undefined, ganador: GanadorDeLista | null | undefined): LineaPromos | null {
  const mejor = datos?.cadenas[0];
  if (!datos || !mejor || !ganador || mejor.productos_en_promo === 0) return null;
  const cambia = mejor.cadena !== ganador.cadena && mejor.total_con_promos < ganador.total;
  const baja = mejor.cadena === ganador.cadena && mejor.total_con_promos <= ganador.total * (1 - BAJA_MINIMA);
  if (!cambia && !baja) return null;
  const donde = `${mejor.cadena} (${direccionPromo(mejor)})`;
  const productos = mejor.productos_en_promo === 1 ? "1 de tus productos en promo" : `${mejor.productos_en_promo} de tus productos en promo`;
  const vigencia = textoVigencia(mejor);
  const resto = `te sale ${formatearPesos(mejor.total_con_promos)}, ${productos}${vigencia ? `, ${vigencia}` : ""}`;
  const texto = cambia
    ? `Con las promos de esta semana conviene ${donde}: ${resto}.`
    : `Con las promos de esta semana, en ${donde} ${resto}.`;
  return { texto, cambia, aviso: avisoPocoInforman(datos.poco_informan) };
}

/** "Coto y Jumbo casi no informan promos en SEPA: si tienen, no están en esta cuenta." */
export function avisoPocoInforman(cadenas: string[]): string {
  if (cadenas.length === 0) return "";
  const nombres = listarConY(cadenas.map(nombreCadena));
  return cadenas.length === 1
    ? `${nombres} casi no informa promos en SEPA: si tiene, no están en esta cuenta.`
    : `${nombres} casi no informan promos en SEPA: si tienen, no están en esta cuenta.`;
}
