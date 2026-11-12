import { fechaCorta } from "./formato";
import { listarConY } from "./texto";

/*
  Algunos dias el ZIP de SEPA llega sin una empresa: el 2026-11-11 no trajo a
  Cencosud. Mismo producto usa entonces el precio mas reciente de esas cadenas
  (hasta 2 dias atras, lo controla dbt) y el sitio lo dice. Ver
  docs/DECISIONES.md, "Datos que se pierden en silencio".
*/

export type CadenaDeOtroDia = { cadena: string; fecha_precio: string };

export type CadenasDeOtroDia = { fecha_datos: string | null; cadenas: CadenaDeOtroDia[] };

/** El texto del aviso, o null si no hay nada que avisar. Las cadenas con la
 *  misma fecha se nombran juntas: "Jumbo, Disco y Vea ... los del 10/11". */
export function textoCadenasDeOtroDia(datos: CadenasDeOtroDia | null | undefined): string | null {
  const cadenas = datos?.cadenas ?? [];
  if (cadenas.length === 0) return null;
  const porFecha = new Map<string, string[]>();
  for (const c of cadenas) porFecha.set(c.fecha_precio, [...(porFecha.get(c.fecha_precio) ?? []), c.cadena]);
  const nombres = listarConY(cadenas.map((c) => c.cadena));
  const del = fechaCorta(datos?.fecha_datos);
  const fechas = [...porFecha.keys()].sort().reverse();
  const usados =
    fechas.length === 1
      ? `los del ${fechaCorta(fechas[0])}`
      : `los más recientes: ${listarConY(fechas.map((f) => `${listarConY(porFecha.get(f) ?? [])} del ${fechaCorta(f)}`))}`;
  return `SEPA no publicó los precios de ${nombres}${del ? ` del ${del}` : ""}: se muestran ${usados}.`;
}

/** La etiqueta de una fila cuyo precio no es del dia, o null si lo es. */
export function etiquetaFechaPrecio(fechaPrecio: string | undefined, fechaDatos: string | undefined): string | null {
  if (!fechaPrecio || !fechaDatos || fechaPrecio === fechaDatos) return null;
  const corta = fechaCorta(fechaPrecio);
  return corta ? `precio del ${corta}` : null;
}
