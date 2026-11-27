import { useEffect, useState } from "react";
import MayoristasDeTuLista from "./MayoristasDeTuLista";
import { cotizarLista, obtenerPromosDeLista, obtenerPromosDeProductos } from "../api/client";
import { useZona } from "../contexto/zona";
import { fechaEnPalabras, formatearPesos } from "../utils/formato";
import { listaALink, MAXIMO_UNIDADES } from "../utils/lista";
import { textoDeLista } from "../utils/compartir";
import { comparacionDeLista, productosComparados, vistaDeLista } from "../utils/listaEnZona";
import { claseCambio, textoCambioLista } from "../utils/cambioPrecio";
import { promosQueConvienen, resumenPromosDeLista } from "../utils/promosCerca";
import { lineaPromosDeLista } from "../utils/promosDeLista";
import { listarConY } from "../utils/texto";
import { cadenasVisibles, rotuloZona } from "../utils/zona";
import type { ItemLista, PromoCerca, PromosDeLista, ResultadoLista } from "../types";
import BotonCompartir from "./BotonCompartir";
import PromoCercana from "./PromoCercana";

/*
  Tu lista (2026-10-08): cuanto sale en cada cadena una lista de productos
  exactos, los de siempre de cada uno.

  La seccion respondia de a un producto -"¿cuanto cuesta esta yerba en cada
  cadena?"- y la pregunta real es la de la compra: "si compro siempre esto,
  ¿donde me conviene?". Es lo que la diferencia de Tu canasta, que cotiza
  categorias y gamas; aca son los codigos de barras exactos.

  Un total solo se compara con otro si las dos cadenas tienen los mismos
  productos: una cadena a la que le falta el aceite suma menos porque compra
  menos, no porque sea mas barata. Por eso el titular compara solo cadenas con
  la lista completa, y las incompletas van aparte diciendo que les falta.

  Con zona (2026-11, openspec lista-en-tu-zona) se compara entre las cadenas
  que el usuario tiene cerca, y las del resto del pais van aparte, plegadas y
  sin ahorro: con Lomas de Zamora elegida, el titular decia "ahorras 11%"
  contra la Cooperativa Obrera, que ahi no existe.

  Con zona (2026-11, openspec promos-de-tu-lista), debajo de cada producto va
  la mejor promo de una sucursal cercana, si lo deja mas barato que la cadena
  mas barata de la zona. Los totales no las incluyen: las informan sobre todo
  Cooperativa Obrera, Carrefour y Dia, y mezclarlas haria ganar a quien mas
  informa, no a quien cobra menos.
*/

type Props = {
  lista: ItemLista[];
  onCambiarCantidad: (id: string, cantidad: number) => void;
  onQuitar: (id: string) => void;
  onVaciar: () => void;
  onVer: (id: string) => void;
};

type Estado = { clave: string; resultado?: ResultadoLista; error?: string };
type EstadoPromos = { clave: string; promos: Record<string, PromoCerca[]> };
type EstadoConPromos = { clave: string; datos: PromosDeLista | null };

/** Las incompletas suelen ser muchas y valen menos: se muestran las primeras. */
const INCOMPLETAS_VISIBLES = 4;

function TuLista({ lista, onCambiarCantidad, onQuitar, onVaciar, onVer }: Props) {
  // La lista serializada: es la dependencia del efecto (un arreglo nuevo en cada
  // render dispararia una cotizacion por render) y lleva todo lo que se cotiza.
  // La zona tambien: cambiarla o borrarla vuelve a cotizar.
  const { zona } = useZona();
  const clave =
    lista.length > 0
      ? JSON.stringify([lista.map((i) => [i.id_producto, i.cantidad]), zona?.cadenas ?? [], zona?.mayoristas ?? []])
      : "";
  const [estado, setEstado] = useState<Estado | null>(null);
  const [verTodas, setVerTodas] = useState(false);
  // Las promos dependen de que productos hay y de donde, no de las cantidades.
  const clavePromos =
    lista.length > 0 && zona ? JSON.stringify([lista.map((i) => i.id_producto), zona.latitud, zona.longitud]) : "";
  const [promos, setPromos] = useState<EstadoPromos | null>(null);
  const [conPromos, setConPromos] = useState<EstadoConPromos | null>(null);

  useEffect(() => {
    if (!clavePromos) return;
    let cancelado = false;
    const espera = setTimeout(() => {
      const [ids, latitud, longitud] = JSON.parse(clavePromos) as [string[], number, number];
      obtenerPromosDeProductos(ids, { latitud, longitud })
        .then((respuesta) => {
          if (!cancelado) setPromos({ clave: clavePromos, promos: respuesta });
        })
        // Las promos son un agregado: si fallan, la lista se ve igual.
        .catch(() => {
          if (!cancelado) setPromos({ clave: clavePromos, promos: {} });
        });
    }, 250);
    return () => {
      cancelado = true;
      clearTimeout(espera);
    };
  }, [clavePromos]);

  useEffect(() => {
    if (!clave) return;
    let cancelado = false;
    // Se espera un momento: apretar "+" varias veces seguidas no tiene que
    // disparar una cotizacion por click.
    const espera = setTimeout(() => {
      const [pares, cadenas, mayoristas] = JSON.parse(clave) as [[string, number][], string[], string[]];
      cotizarLista(
        pares.map(([id_producto, cantidad]) => ({ id_producto, cantidad })),
        cadenas,
        // Los mayoristas cerca (openspec sumar-mayoristas): van aparte, al final.
        mayoristas,
      )
        .then((resultado) => {
          if (!cancelado) setEstado({ clave, resultado });
        })
        .catch((err) => {
          if (!cancelado) setEstado({ clave, error: err.message });
        });
    }, 250);
    return () => {
      cancelado = true;
      clearTimeout(espera);
    };
  }, [clave]);

  // Mientras llega la cotizacion nueva se sigue mostrando la anterior: los
  // numeros cambian en el lugar en vez de parpadear.
  const r = estado?.resultado;
  const nombres = new Map(lista.map((i) => [i.id_producto, i.nombre]));
  const vista = r ? vistaDeLista(r, zona ? cadenasVisibles(zona) : null) : null;
  const enZona = vista?.alcance === "zona";
  const completas = vista?.completas ?? [];
  const incompletas = vista?.incompletas ?? [];
  const comparados = r && vista ? productosComparados(r, vista) : lista.length;
  // El total con las promos cerca (total-con-promos-cerca): con los mismos
  // productos que el total de la zona, sin los que no tiene ninguna cadena cerca.
  const claveConPromos =
    zona && enZona && estado?.clave === clave
      ? JSON.stringify([
          lista.filter((i) => !vista!.noEnZona.includes(i.id_producto)).map((i) => [i.id_producto, i.cantidad]),
          zona.cadenas,
          zona.latitud,
          zona.longitud,
        ])
      : "";

  useEffect(() => {
    if (!claveConPromos) return;
    let cancelado = false;
    const [pares, cadenas, latitud, longitud] = JSON.parse(claveConPromos) as [[string, number][], string[], number, number];
    if (pares.length === 0) return;
    obtenerPromosDeLista(
      pares.map(([id_producto, cantidad]) => ({ id_producto, cantidad })),
      { cadenas, latitud, longitud }
    )
      .then((datos) => {
        if (!cancelado) setConPromos({ clave: claveConPromos, datos });
      })
      // Es un agregado: si falla, la lista se ve igual, sin la linea.
      .catch(() => {
        if (!cancelado) setConPromos({ clave: claveConPromos, datos: null });
      });
    return () => {
      cancelado = true;
    };
  }, [claveConPromos]);
  const nombrar = (ids: string[]) => listarConY(ids.map((id) => nombres.get(id) ?? id));
  // El titular es la mas barata de todas, Maxi incluido (ver CanastaPorCadena).
  const barata = completas[0];
  const cara = completas[completas.length - 1];
  const ahorro = barata && cara && completas.length > 1 ? cara.total - barata.total : 0;
  const comparacion = comparacionDeLista(barata, completas.length > 1 ? cara : undefined);
  // Una zona donde una sola cadena vende la lista: se dice, sin ahorro.
  const unicaDeLaZona = enZona && completas.length === 1 && incompletas.length === 0;
  const maximo = Math.max(...completas.map((c) => c.total), 1);
  const unidades = lista.reduce((suma, i) => suma + i.cantidad, 0);
  // Solo con la cotizacion y las promos de esta misma lista y zona: con una
  // cotizacion vieja, el filtro compararia contra los precios de otra zona.
  const mejorPromo = new Map<string, PromoCerca>();
  if (zona && estado?.clave === clave && r?.zona && promos?.clave === clavePromos) {
    const masBarato = r.zona.mas_barato;
    for (const item of lista) {
      const [mejor] = promosQueConvienen(promos.promos[item.id_producto], masBarato[item.id_producto]?.precio);
      if (mejor) mejorPromo.set(item.id_producto, mejor);
    }
  }
  const resumenPromos = resumenPromosDeLista(mejorPromo.size);
  const lineaPromos =
    claveConPromos && conPromos?.clave === claveConPromos && completas[0]
      ? lineaPromosDeLista(conPromos.datos, { cadena: completas[0].cadena, total: completas[0].total })
      : null;
  // El cambio de precio de la cadena mas barata de la zona (historia-de-precio).
  // Misma condicion que las promos: solo con la cotizacion de esta lista y zona.
  const cambioDeZona = new Map<string, string>();
  const claseDeCambio = new Map<string, string>();
  if (zona && estado?.clave === clave && r?.zona) {
    for (const item of lista) {
      const elegido = r.zona.mas_barato[item.id_producto];
      if (elegido?.cambio) {
        cambioDeZona.set(item.id_producto, textoCambioLista(elegido.cambio, elegido.cadena));
        claseDeCambio.set(item.id_producto, claseCambio(elegido.cambio));
      }
    }
  }

  return (
    <section aria-labelledby="titulo-lista" className="mb-10 tarjeta p-4 sm:p-6">
      <div className="flex items-baseline justify-between gap-4 mb-4">
        <h2 id="titulo-lista" className="font-display text-2xl text-tinta">
          Tu lista
        </h2>
        <p className="text-xs text-tinta-suave">
          {lista.length} {lista.length === 1 ? "producto" : "productos"}
          {unidades > lista.length && ` · ${unidades} unidades`}
          {" · "}
          <button onClick={onVaciar} className="underline underline-offset-2 hover:text-tinta">
            vaciar
          </button>
        </p>
      </div>
      {/* Mandar la lista por WhatsApp (openspec compartir-y-pegar-la-lista): un
          texto que se entiende sin abrir el link, mas el link que la rearma. */}
      <div className="mb-4">
        <BotonCompartir
          etiqueta="Compartir lista"
          copiarTexto
          datos={() => ({
            titulo: "Mi lista del súper",
            texto: textoDeLista(lista, barata ?? null, zona ? rotuloZona(zona) : null, formatearPesos),
            url: `${window.location.origin}/lista?l=${listaALink(lista)}`,
          })}
        />
      </div>

      {zona && vista && (
        <div className="mb-3 text-sm">
          <p className="text-xs font-bold text-ahorro uppercase tracking-wide">📍 En tu zona · {rotuloZona(zona)}</p>
          {vista.nadaEnZona && (
            <p className="text-tinta-media mt-1">
              Ninguna cadena cerca informa precios de tus productos. Abajo, cuánto salen en las cadenas del país.
            </p>
          )}
          {enZona && vista.noEnZona.length > 0 && (
            <p className="text-aviso mt-1">
              {/* SEPA es una lista de precios, no de stock: no se puede decir que
                  "no se consigue" (arreglos-segundo-explore). */}
              Ninguna cadena cerca informa precio de: {nombrar(vista.noEnZona)}. La comparación es con{" "}
              {comparados === 1 ? "el otro producto" : `los otros ${comparados}`}.
            </p>
          )}
          {resumenPromos && <p className="text-tinta font-semibold mt-1">🏷️ {resumenPromos}: mirá debajo de cada uno.</p>}
        </div>
      )}

      {barata && (
        <div className="mb-5">
          <p className="text-lg sm:text-xl text-tinta leading-snug">
            {unicaDeLaZona ? "La única cadena de tu zona con tus productos es " : "En "}
            <strong className="font-semibold">{barata.cadena}</strong>
            {unicaDeLaZona ? ": te sale " : " te sale "}
            <strong className="font-semibold numero">{formatearPesos(barata.total)}</strong>
            {comparacion === "ahorro" && (
              <>
                {" "}
                y en {cara.cadena} {formatearPesos(cara.total)}:{" "}
                <span className="text-ahorro font-semibold numero">
                  ahorrás {formatearPesos(ahorro)} ({Math.round((ahorro / cara.total) * 100)}%)
                </span>
              </>
            )}
            {/* Menos del 5%: casi lo mismo, como en el detalle del producto. */}
            {comparacion === "casi_igual" && (
              <>
                {" "}
                y en {cara.cadena} {formatearPesos(cara.total)}: cuesta casi lo mismo,{" "}
                <span className="numero">{formatearPesos(ahorro)}</span> de diferencia
              </>
            )}
          </p>
          {vista && vista.combinando < barata.total - 0.5 && (
            <p className="text-sm text-tinta-media mt-1">
              Comprando cada producto donde está más barato{enZona && " en tu zona"}, {formatearPesos(vista.combinando)},
              aunque eso es ir a varias cadenas.
            </p>
          )}
          {/* Debajo y aparte del total de siempre, que sigue a precio de lista
              (total-con-promos-cerca). */}
          {lineaPromos && (
            <div className="mt-3 pl-3 border-l-2 border-ahorro text-sm">
              <p className={lineaPromos.cambia ? "text-tinta font-semibold" : "text-tinta"}>{lineaPromos.texto}</p>
              {lineaPromos.aviso && <p className="text-xs text-tinta-suave mt-0.5">{lineaPromos.aviso}</p>}
            </div>
          )}
        </div>
      )}
      {r && !barata && r.productos.length > 0 && (
        <p className="text-sm text-tinta-media mb-5">
          Ninguna cadena {enZona && "de tu zona "}tiene todos los productos de tu lista, así que los totales no se comparan entre sí. Abajo,
          cuántos tiene cada una.
        </p>
      )}
      {estado?.error && <p className="text-sm text-alerta mb-4">{estado.error}</p>}
      {!zona && r && (
        <p className="text-sm text-tinta-media mb-4">
          Elegí tu zona arriba y te mostramos qué productos de tu lista están en promo cerca tuyo.
        </p>
      )}

      <ul className="divide-y divide-linea border-y border-linea mb-5">
        {lista.map((item) => (
          <li key={item.id_producto} className="py-2">
            <div className="flex items-center gap-3">
              <button
                onClick={() => onVer(item.id_producto)}
                className="flex-1 min-w-0 text-left text-sm text-tinta truncate hover:text-marca"
              >
                {item.nombre}
              </button>
              <span className="flex items-center gap-1 shrink-0" role="group" aria-label={`Cantidad de ${item.nombre}`}>
                <button
                  onClick={() => onCambiarCantidad(item.id_producto, item.cantidad - 1)}
                  disabled={item.cantidad <= 1}
                  className="w-7 h-7 rounded-full border border-linea text-tinta-media disabled:opacity-40 hover:border-tinta"
                  aria-label="Una menos"
                >
                  −
                </button>
                <span className="w-6 text-center text-sm numero">{item.cantidad}</span>
                <button
                  onClick={() => onCambiarCantidad(item.id_producto, item.cantidad + 1)}
                  disabled={item.cantidad >= MAXIMO_UNIDADES}
                  className="w-7 h-7 rounded-full border border-linea text-tinta-media disabled:opacity-40 hover:border-tinta"
                  aria-label="Una más"
                >
                  +
                </button>
              </span>
              <button
                onClick={() => onQuitar(item.id_producto)}
                className="w-7 h-7 shrink-0 text-tinta-suave hover:text-alerta"
                aria-label={`Quitar ${item.nombre}`}
              >
                ×
              </button>
            </div>
            {cambioDeZona.has(item.id_producto) && (
              <p className={`text-xs mt-0.5 ${claseDeCambio.get(item.id_producto)}`}>{cambioDeZona.get(item.id_producto)}</p>
            )}
            {mejorPromo.has(item.id_producto) && (
              <div className="mt-1.5 mb-0.5 pl-3 border-l-2 border-ahorro">
                <PromoCercana promo={mejorPromo.get(item.id_producto)!} />
              </div>
            )}
          </li>
        ))}
      </ul>

      {completas.length > 0 && (
        <>
          <h3 className="text-base font-bold text-tinta mb-2">
            Con todos tus productos
          </h3>
          <ul className="space-y-1.5 mb-5">
            {completas.map((c) => (
              <li key={c.cadena} className="grid grid-cols-[minmax(0,9rem)_1fr_auto] sm:grid-cols-[11rem_1fr_auto] items-center gap-3">
                <span className={`text-sm truncate ${c === barata ? "text-tinta font-semibold" : "text-tinta-media"}`}>
                  {c.cadena}
                </span>
                <span className="h-2 bg-papel-hundido rounded-full overflow-hidden" aria-hidden="true">
                  <span
                    className={`block h-full rounded-full ${c === barata ? "bg-ahorro" : "bg-marca/40"}`}
                    style={{ width: `${(c.total / maximo) * 100}%` }}
                  />
                </span>
                <span className={`numero text-sm text-right ${c === barata ? "font-semibold text-tinta" : "text-tinta-media"}`}>
                  {formatearPesos(c.total)}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}

      {incompletas.length > 0 && (
        <>
          <h3 className="text-base font-bold text-tinta mb-2">
            Les falta algún producto
          </h3>
          <ul className="divide-y divide-linea mb-2">
            {(verTodas ? incompletas : incompletas.slice(0, INCOMPLETAS_VISIBLES)).map((c) => (
              <li key={c.cadena} className="py-1.5">
                <span className="flex items-baseline justify-between gap-3 text-sm text-tinta-media">
                  <span className="truncate">{c.cadena}</span>
                  <span className="numero shrink-0">
                    {formatearPesos(c.total)}{" "}
                    <span className="text-xs text-tinta-suave">
                      por {c.productos_con_precio} de {comparados}
                    </span>
                  </span>
                </span>
                <span className="block text-xs text-tinta-suave">
                  No tiene {c.faltan.map((id) => nombres.get(id) ?? id).join(", ")}
                </span>
              </li>
            ))}
          </ul>
          {incompletas.length > INCOMPLETAS_VISIBLES && (
            <button
              onClick={() => setVerTodas((v) => !v)}
              className="text-xs text-tinta-media underline underline-offset-2 hover:text-tinta mb-5"
            >
              {verTodas ? "Ver menos" : `Ver las ${incompletas.length - INCOMPLETAS_VISIBLES} restantes`}
            </button>
          )}
          {incompletas.length <= INCOMPLETAS_VISIBLES && <div className="mb-3" />}
        </>
      )}

      {/* Mayoristas cerca, aparte de los totales (openspec sumar-mayoristas). */}
      {zona && r?.mayoristas && <MayoristasDeTuLista filas={r.mayoristas} />}

      {enZona && vista && vista.otras.length > 0 && r && (
        <details className="mb-5 group">
          <summary className="cursor-pointer text-sm text-tinta-media underline underline-offset-2 hover:text-tinta">
            Otras cadenas del país ({vista.otras.length})
          </summary>
          <p className="text-xs text-tinta-suave mt-2 mb-1">
            No tienen sucursal en tu zona, así que no entran en la comparación.
          </p>
          <ul className="divide-y divide-linea">
            {vista.otras.map((c) => (
              <li key={c.cadena} className="py-1.5 flex items-baseline justify-between gap-3 text-sm text-tinta-media">
                <span className="truncate">{c.cadena}</span>
                <span className="numero shrink-0">
                  {formatearPesos(c.total)}
                  {!c.completa && (
                    <span className="text-xs text-tinta-suave">
                      {" "}
                      por {c.productos_con_precio} de {r.productos.length}
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </details>
      )}

      {r && r.no_encontrados.length > 0 && (
        <p className="text-xs text-aviso mb-3">
          {r.no_encontrados.length === 1 ? "Un producto ya no tiene" : `${r.no_encontrados.length} productos ya no tienen`}{" "}
          precio en dos o más cadenas hoy:{" "}
          {r.no_encontrados.map((id) => nombres.get(id) ?? id).join(", ")}.
        </p>
      )}

      <p className="text-xs text-tinta-suave leading-relaxed">
        El precio de cada cadena es la mediana entre todas sus sucursales del país
        {r?.fecha_datos && `, con precios del ${fechaEnPalabras(r.fecha_datos)}`}. En tu sucursal puede variar. Solo
        cuentan los precios que coinciden con el resto del mercado. La lista se guarda en este navegador.
      </p>
    </section>
  );
}

export default TuLista;
