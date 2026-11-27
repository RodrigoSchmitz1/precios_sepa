import type { CanastaPorCadena } from "../types";
import { formatearPesos, porcentajeEntero } from "./formato";
import { nombreCadena } from "./nombres";

/*
  Las tarjetas de la portada (openspec portada-de-tu-zona; desde
  app-para-el-usuario, solo la de una zona con una sola cadena).

  Con "Lomas de Zamora" elegida, la portada decia "Maxi" (la mas barata del
  pais) y "ahorras 12%" entre dos cadenas que casi nadie tiene cerca a la vez:
  la zona solo cambiaba una linea chica. Ahora, con zona, la tarjeta principal
  y la de ahorro son de la zona, y lo que sigue siendo nacional (la inflacion)
  lo dice en la misma tarjeta.
*/

export type CifraPortada = {
  etiqueta: string;
  valor: string;
  detalle: string;
  chip: string;
  chipClase: string;
};

export type DatosPortada = {
  canasta?: CanastaPorCadena;
  /** La canasta se cotizo en las sucursales de la zona (y no en el pais). */
  canastaDeZona?: boolean;
};

/** La sucursal mas cercana de otra cadena, para una zona con una sola cadena cerca (/zonas). */
export type OtraCadenaCerca = { cadena: string; km: number };

/**
 * zonaCadenas: las cadenas cerca de la zona (Zona.cadenas), o null sin zona.
 *
 * Desde app-para-el-usuario (2026-11-27) la portada tiene una sola cifra, la de
 * tu compra (TarjetaTuLista). Las tarjetas del lider, "Lo que mas subio" y el
 * ahorro de la canasta salieron: la del lider nombraba Market mientras tu
 * compra salia mas barata en Dia. Queda solo el caso de una zona con una sola
 * cadena, que dice lo que cuesta no tener opciones.
 */
export function cifrasDePortada(
  datos: DatosPortada,
  zonaCadenas: string[] | null,
  otraCadenaCerca?: OtraCadenaCerca | null
): CifraPortada[] {
  if (zonaCadenas === null || zonaCadenas.length !== 1) return [];
  const cifras: CifraPortada[] = [
    {
      etiqueta: "Tu única cadena cerca",
      valor: nombreCadena(zonaCadenas[0]),
      // Cuanto hay que viajar para tener otra opcion (cadenas-cerca-de-tu-zona).
      detalle: otraCadenaCerca
        ? `La otra cadena más cercana, ${nombreCadena(otraCadenaCerca.cadena)}, está a unos ${otraCadenaCerca.km} km`
        : "SEPA no informa otra cadena cerca de tu zona",
      chip: "📍 tu zona",
      chipClase: "bg-marca/10 text-marca",
    },
  ];
  // Con una sola cadena la API no compara por zona y cotiza el pais: el total
  // de esa cadena sigue sirviendo, porque se mide por su nivel de precios en
  // productos identicos, que es parejo en todo el pais.
  const canasta = datos.canasta;
  const unica = canasta?.cadenas.find((c) => c.cadena === nombreCadena(zonaCadenas[0]));
  if (canasta && unica) {
    cifras.push({
      etiqueta: `La canasta básica en ${unica.cadena}`,
      valor: formatearPesos(unica.total),
      detalle:
        queSeCompara(canasta) +
        (datos.canastaDeZona ? ", en las sucursales de tu zona" : ", con los precios de la cadena en todo el país") +
        costoDeNoTenerOpciones(canasta, unica, datos.canastaDeZona),
      chip: "🧺 canasta básica",
      chipClase: "bg-ahorro-tenue text-ahorro",
    });
  }
  return cifras;
}

/**
 * Lo que cuesta no tener opciones (cadenas-cerca-de-tu-zona, 2026-11-18): la
 * misma canasta en la cadena mas barata del pais. Medido ese dia: Dia +8%,
 * La Anonima +14% contra Maxi. Se dice como un costo, no como un "ahorras":
 * la mas barata del pais no esta a mano. Solo con el ranking del pais, que es
 * el que trae a todas las cadenas.
 */
function costoDeNoTenerOpciones(
  canasta: CanastaPorCadena,
  unica: CanastaPorCadena["cadenas"][number],
  canastaDeZona: boolean | undefined
): string {
  if (canastaDeZona || canasta.ambito !== "pais") return "";
  const barata = canasta.cadenas.reduce((menor, c) => (c.total < menor.total ? c : menor), canasta.cadenas[0]);
  if (!barata || barata.cadena === unica.cadena || barata.total >= unica.total) return "";
  return `. En ${barata.cadena}, la más barata del país, sale ${porcentajeEntero((unica.total - barata.total) / unica.total)} menos`;
}

function queSeCompara(canasta: CanastaPorCadena): string {
  const comparadas = canasta.categorias_comparadas.length;
  return comparadas < canasta.total_categorias
    ? `${comparadas} de las ${canasta.total_categorias} categorías`
    : "las categorías de la canasta";
}
