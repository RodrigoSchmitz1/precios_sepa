import { useEffect, useState } from "react";
import { cotizarLista } from "../api/client";
import { fechaEnPalabras, formatearPesos } from "../utils/formato";
import { MAXIMO_UNIDADES } from "../utils/lista";
import type { ItemLista, ResultadoLista } from "../types";

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
*/

type Props = {
  lista: ItemLista[];
  onCambiarCantidad: (id: string, cantidad: number) => void;
  onQuitar: (id: string) => void;
  onVaciar: () => void;
  onVer: (id: string) => void;
};

type Estado = { clave: string; resultado?: ResultadoLista; error?: string };

/** Las incompletas suelen ser muchas y valen menos: se muestran las primeras. */
const INCOMPLETAS_VISIBLES = 4;

function TuLista({ lista, onCambiarCantidad, onQuitar, onVaciar, onVer }: Props) {
  // La lista serializada: es la dependencia del efecto (un arreglo nuevo en cada
  // render dispararia una cotizacion por render) y lleva todo lo que se cotiza.
  const clave = lista.length > 0 ? JSON.stringify(lista.map((i) => [i.id_producto, i.cantidad])) : "";
  const [estado, setEstado] = useState<Estado | null>(null);
  const [verTodas, setVerTodas] = useState(false);

  useEffect(() => {
    if (!clave) return;
    let cancelado = false;
    // Se espera un momento: apretar "+" varias veces seguidas no tiene que
    // disparar una cotizacion por click.
    const espera = setTimeout(() => {
      const pares = JSON.parse(clave) as [string, number][];
      cotizarLista(pares.map(([id_producto, cantidad]) => ({ id_producto, cantidad })))
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
  const completas = r?.cadenas.filter((c) => c.completa) ?? [];
  const incompletas = r?.cadenas.filter((c) => !c.completa) ?? [];
  const barata = completas[0];
  const cara = completas[completas.length - 1];
  const ahorro = barata && cara && completas.length > 1 ? cara.total - barata.total : 0;
  const maximo = Math.max(...completas.map((c) => c.total), 1);
  const unidades = lista.reduce((suma, i) => suma + i.cantidad, 0);

  return (
    <section aria-labelledby="titulo-lista" className="mb-10 bg-papel border border-linea rounded-2xl p-4 sm:p-6">
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

      {barata && (
        <div className="mb-5">
          <p className="text-lg sm:text-xl text-tinta leading-snug">
            En <strong className="font-semibold">{barata.cadena}</strong> te sale{" "}
            <strong className="font-semibold numero">{formatearPesos(barata.total)}</strong>
            {ahorro > 0 && (
              <>
                {" "}
                y en {cara.cadena} {formatearPesos(cara.total)}:{" "}
                <span className="text-ahorro font-semibold numero">
                  ahorrás {formatearPesos(ahorro)} ({Math.round((ahorro / cara.total) * 100)}%)
                </span>
              </>
            )}
          </p>
          {r && r.combinando_cadenas < barata.total - 0.5 && (
            <p className="text-sm text-tinta-media mt-1">
              Comprando cada producto donde está más barato, {formatearPesos(r.combinando_cadenas)}, aunque eso es ir
              a varias cadenas.
            </p>
          )}
        </div>
      )}
      {r && !barata && r.productos.length > 0 && (
        <p className="text-sm text-tinta-media mb-5">
          Ninguna cadena tiene todos los productos de tu lista, así que los totales no se comparan entre sí. Abajo,
          cuántos tiene cada una.
        </p>
      )}
      {estado?.error && <p className="text-sm text-alerta mb-4">{estado.error}</p>}

      <ul className="divide-y divide-linea border-y border-linea mb-5">
        {lista.map((item) => (
          <li key={item.id_producto} className="flex items-center gap-3 py-2">
            <button
              onClick={() => onVer(item.id_producto)}
              className="flex-1 min-w-0 text-left text-sm text-tinta truncate hover:text-ahorro"
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
          </li>
        ))}
      </ul>

      {completas.length > 0 && (
        <>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-tinta-suave mb-2">
            Con todos tus productos
          </h3>
          <ul className="space-y-1.5 mb-5">
            {completas.map((c, i) => (
              <li key={c.cadena} className="grid grid-cols-[minmax(0,9rem)_1fr_auto] sm:grid-cols-[11rem_1fr_auto] items-center gap-3">
                <span className={`text-sm truncate ${i === 0 ? "text-tinta font-semibold" : "text-tinta-media"}`}>
                  {c.cadena}
                </span>
                <span className="h-2 bg-papel-hundido rounded-full overflow-hidden" aria-hidden="true">
                  <span
                    className={`block h-full rounded-full ${i === 0 ? "bg-ahorro" : "bg-tinta-suave/50"}`}
                    style={{ width: `${(c.total / maximo) * 100}%` }}
                  />
                </span>
                <span className={`numero text-sm text-right ${i === 0 ? "font-semibold text-tinta" : "text-tinta-media"}`}>
                  {formatearPesos(c.total)}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}

      {incompletas.length > 0 && (
        <>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-tinta-suave mb-2">
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
                      por {c.productos_con_precio} de {lista.length}
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
