import type { CanastaPorCadena, InflacionResumen, QuienGana } from "../types";
import { ahorroEnCadenas } from "./ahorroCanasta";
import { formatearPesos, formatearVariacion, mesEnPalabras } from "./formato";
import { liderEn } from "./liderazgo";
import { nombreCadena, nombreCategoria } from "./nombres";

/*
  Las tres tarjetas de la portada (openspec portada-de-tu-zona).

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
  inflacion?: InflacionResumen[];
  /** Con zona, el resultado de /quien-gana/zona; sin zona, el nacional. */
  quienGana?: QuienGana[];
  canasta?: CanastaPorCadena;
  /** La canasta se cotizo en las sucursales de la zona (y no en el pais). */
  canastaDeZona?: boolean;
};

/** zonaCadenas: las cadenas con sucursal en la zona (Zona.cadenas), o null sin zona. */
export function cifrasDePortada(datos: DatosPortada, zonaCadenas: string[] | null): CifraPortada[] {
  const cifras: CifraPortada[] = [];
  const conZona = zonaCadenas !== null;
  const unaSola = conZona && zonaCadenas.length === 1;

  // 1. La cadena mas barata: de la zona si hay zona.
  if (unaSola) {
    cifras.push({
      etiqueta: "Tu única cadena cerca",
      valor: nombreCadena(zonaCadenas[0]),
      detalle: "SEPA informa una sola cadena en tu zona",
      chip: "📍 tu zona",
      chipClase: "bg-marca/10 text-marca",
    });
  } else {
    const filas = datos.quienGana ?? [];
    const categorias = [...new Set(filas.map((f) => f.categoria))];
    const lider = liderEn(filas, categorias);
    if (lider) {
      cifras.push({
        etiqueta: conZona ? "Tu súper más barato cerca" : "Más barata en más categorías",
        valor: lider[0],
        detalle: `en ${lider[1]} de ${categorias.length} categorías${conZona ? ", entre las cadenas de tu zona" : ""}`,
        chip: conZona ? "📍 #1 en tu zona" : "🏆 #1 del día",
        chipClase: "bg-ahorro-tenue text-ahorro",
      });
    }
  }

  // 2. Lo que mas subio: siempre del pais (la inflacion es nacional).
  // "Cuantas subieron" no decia nada: con inflacion casi todas suben siempre.
  const masSubio = (datos.inflacion ?? []).reduce<InflacionResumen | undefined>(
    (mayor, f) => (!mayor || f.variacion_pct > mayor.variacion_pct ? f : mayor),
    undefined
  );
  if (masSubio && masSubio.variacion_pct > 0) {
    cifras.push({
      etiqueta: "Lo que más subió",
      valor: formatearVariacion(masSubio.variacion_pct, 1),
      detalle: `${nombreCategoria(masSubio.categoria)}, en lo que va de ${mesEnPalabras(masSubio.mes)}${conZona ? " · todo el país" : ""}`,
      chip: "▲ el que más subió",
      chipClase: "bg-alerta-tenue text-alerta",
    });
  }

  // 3. El ahorro: entre las cadenas de la zona si la canasta se pudo cotizar ahi.
  const canasta = datos.canasta;
  if (unaSola) {
    // Con una sola cadena la API no compara por zona y cotiza el pais: el
    // total de esa cadena sigue sirviendo, porque se mide por su nivel de
    // precios en productos identicos, que es parejo en todo el pais.
    const nombre = nombreCadena(zonaCadenas[0]);
    const unica = canasta?.cadenas.find((c) => c.cadena === nombre);
    if (canasta && unica) {
      cifras.push({
        etiqueta: `La canasta básica en ${unica.cadena}`,
        valor: formatearPesos(unica.total),
        detalle:
          queSeCompara(canasta) +
          (datos.canastaDeZona ? ", en las sucursales de tu zona" : ", con los precios de la cadena en todo el país"),
        chip: "🧺 canasta básica",
        chipClase: "bg-ahorro-tenue text-ahorro",
      });
    }
    // Nunca el ahorro del pais: compararia cadenas que en esta zona no existen.
    return cifras;
  }
  const ahorro = ahorroEnCadenas(canasta);
  if (ahorro) {
    const deZona = conZona && datos.canastaDeZona;
    cifras.push({
      etiqueta: deZona ? "Cuánto ahorrás en tu zona" : "Cuánto ahorrás eligiendo dónde",
      valor: `${ahorro.pct}%`,
      detalle: ahorro.detalle + (conZona && !deZona ? " · todo el país" : ""),
      chip: "💰 canasta básica",
      chipClase: "bg-ahorro-tenue text-ahorro",
    });
  }
  return cifras;
}

function queSeCompara(canasta: CanastaPorCadena): string {
  const comparadas = canasta.categorias_comparadas.length;
  return comparadas < canasta.total_categorias
    ? `${comparadas} de las ${canasta.total_categorias} categorías`
    : "las categorías de la canasta";
}
