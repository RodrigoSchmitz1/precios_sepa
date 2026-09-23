import { useEffect, useMemo, useState } from "react";
import { obtenerInflacionResumen } from "../api/client";
import DetalleInflacionCadenas from "../components/DetalleInflacionCadenas";
import Titular, { Resaltado } from "../components/Titular";
import FilaDeCifras from "../components/FilaDeCifras";
import { fechaEnPalabras, formatearVariacion } from "../utils/formato";
import type { InflacionResumen } from "../types";

/*
  Inflacion: ranking de todas las categorias por variacion de precios. Antes se
  titulaba "Que se movio"; se unifico con el nombre del menu para que la seccion
  no se llame de dos formas segun por donde se entre.

  POR QUE ESTA DADA VUELTA RESPECTO DE LA VERSION ANTERIOR
  Antes la pagina abria con un selector de categoria y mostraba sus 14 cadenas.
  Eso obligaba a adivinar: como el 97,9% de los productos no cambia de precio de
  un dia al otro, casi cualquier categoria que uno eligiera daba una pantalla de
  ceros. La pregunta que trae al lector no es "que paso en Aceites", es "que
  paso". Asi que lo primero es el ranking completo del mercado, y la apertura
  por cadena queda como segundo click.

  Las barras divergentes son el grafico propio de esta pagina: el lado respecto
  de la linea de cero dice la direccion y el largo dice la magnitud.
*/

function diasEntre(desde: string, hasta: string): number {
  const aNumero = (iso: string) => {
    const [a, m, d] = iso.split("-").map(Number);
    return Date.UTC(a, m - 1, d);
  };
  return Math.round((aNumero(hasta) - aNumero(desde)) / 86400000);
}

type Estado = { filas?: InflacionResumen[]; error?: string };

function InflacionPage() {
  const [estado, setEstado] = useState<Estado | null>(null);
  const [abierta, setAbierta] = useState<string | null>(null);

  useEffect(() => {
    let cancelado = false;
    obtenerInflacionResumen()
      .then((filas) => {
        if (!cancelado) setEstado({ filas });
      })
      .catch((err) => {
        if (!cancelado) setEstado({ error: err.message });
      });
    return () => {
      cancelado = true;
    };
  }, []);

  const filas = useMemo(() => estado?.filas ?? [], [estado]);

  const resumen = useMemo(() => {
    if (filas.length === 0) return null;
    // El corte en 0,005 es el que usa el redondeo a dos decimales: por debajo,
    // la fila se imprime como "0,00%" y contarla entre las que subieron seria
    // contradecir lo que el lector ve.
    const subieron = filas.filter((f) => f.variacion_pct >= 0.005).length;
    const bajaron = filas.filter((f) => f.variacion_pct <= -0.005).length;
    return {
      subieron,
      bajaron,
      quietas: filas.length - subieron - bajaron,
      dias: diasEntre(filas[0].fecha_inicio, filas[0].fecha_fin),
    };
  }, [filas]);

  const maximo = Math.max(...filas.map((f) => Math.abs(f.variacion_pct)), 0.01);

  /* La escala de la barra es una magnitud, no una variacion: el mayor
     movimiento del periodo puede ser una baja. Escribirla con signo la haria
     leer como una suba, que es justo lo contrario de lo que paso. */
  const magnitudMaxima = `${maximo.toLocaleString("es-AR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}%`;

  // La categoria que mas se movio en cualquiera de las dos direcciones. Las
  // filas vienen ordenadas por variacion descendente, asi que el candidato es
  // la primera o la ultima.
  const masExtrema =
    filas.length > 0
      ? Math.abs(filas[0].variacion_pct) >= Math.abs(filas[filas.length - 1].variacion_pct)
        ? filas[0]
        : filas[filas.length - 1]
      : null;

  return (
    <div className="max-w-4xl mx-auto">
      <Titular
        antetitulo={
          filas.length > 0
            ? `Inflacion · ${fechaEnPalabras(filas[0].fecha_inicio)} al ${fechaEnPalabras(filas[0].fecha_fin)}`
            : "Inflacion"
        }
        bajada={
          <>
            <p>
              La variacion se mide sobre los productos presentes en las dos fechas y encadenando los cambios dia a
              dia: comparar el precio promedio de dos fechas sueltas mezclaria los cambios de precio con los cambios
              de surtido.
            </p>
            {resumen && (
              <p className="mt-2 text-sm text-sobre-oscuro-aviso">
                {resumen.dias === 1
                  ? "Es el movimiento de un solo dia, no de un mes: por eso son decimas y no puntos."
                  : `Es el movimiento acumulado de ${resumen.dias} dias, no de un mes.`}{" "}
                El historico recien empezo a acumularse y suma un eslabon por dia.
              </p>
            )}
          </>
        }
      >
        {resumen && masExtrema ? (
          <>
            <Resaltado>{resumen.subieron}</Resaltado> de {filas.length} categorias subieron de precio y{" "}
            <Resaltado tono="barato">{resumen.bajaron}</Resaltado> bajaron
          </>
        ) : (
          "Que categorias subieron y cuales bajaron"
        )}
      </Titular>

      {estado?.error && (
        <p className="text-sm text-alerta bg-alerta-tenue border border-alerta/20 rounded-lg px-3 py-2">
          No se pudo cargar: {estado.error}
        </p>
      )}

      {estado === null && <p className="text-sm text-tinta-suave">Cargando…</p>}

      {estado?.filas && filas.length === 0 && (
        <p className="text-sm text-tinta-suave">Todavia no hay dos fechas encadenables en el historico.</p>
      )}

      {resumen && masExtrema && (
        <>
          <div className="mb-8">
            <FilaDeCifras
              cifras={[
                {
                  etiqueta: "Periodo",
                  valor: `${resumen.dias} ${resumen.dias === 1 ? "dia" : "dias"}`,
                  detalle: `hasta el ${fechaEnPalabras(filas[0].fecha_fin)}`,
                },
                { etiqueta: "Subieron", valor: resumen.subieron, detalle: `de ${filas.length} categorias` },
                { etiqueta: "Bajaron", valor: resumen.bajaron, detalle: `${resumen.quietas} sin cambio` },
                {
                  etiqueta: "Mayor movimiento",
                  valor: formatearVariacion(masExtrema.variacion_pct),
                  detalle: masExtrema.categoria,
                },
              ]}
            />
          </div>

          <div>
            <div className="flex items-baseline justify-between gap-3 pb-2 border-b border-linea-fuerte mb-2">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-tinta-suave">Todas las categorias</h2>
              <span className="text-xs text-tinta-suave">
                escala hasta {magnitudMaxima} ({masExtrema.categoria})
              </span>
            </div>

            <ul>
              {filas.map((f) => {
                const subio = f.variacion_pct >= 0.005;
                const bajo = f.variacion_pct <= -0.005;
                const estaAbierta = abierta === f.categoria;
                return (
                  <li key={f.categoria}>
                    <button
                      type="button"
                      onClick={() => setAbierta(estaAbierta ? null : f.categoria)}
                      aria-expanded={estaAbierta}
                      className={[
                        "w-full text-left rounded-lg px-2.5 py-2 transition-colors",
                        estaAbierta ? "bg-papel-hundido" : "hover:bg-papel-hundido",
                      ].join(" ")}
                    >
                      <div className="flex items-baseline justify-between gap-3 mb-1">
                        <span className="text-sm text-tinta-media truncate">
                          <span
                            aria-hidden="true"
                            className={[
                              "inline-block text-tinta-suave text-[10px] mr-1.5 transition-transform",
                              estaAbierta ? "rotate-90" : "",
                            ].join(" ")}
                          >
                            &#9654;
                          </span>
                          {f.categoria}
                        </span>
                        <div className="flex items-baseline gap-2.5 shrink-0">
                          {/*
                            La cobertura es lo que permite pesar cada linea: un
                            -2,87% sobre 7 cadenas no vale lo mismo que un
                            +0,34% sobre 14, aunque las dos ocupen una fila.
                          */}
                          <span
                            className="numero text-[11px] text-tinta-suave"
                            title={`Calculado sobre ${f.series} series de precios en ${f.cadenas} cadenas`}
                          >
                            {f.cadenas} cadenas
                          </span>
                          <span
                            className={[
                              "numero text-sm font-semibold w-[4.5rem] text-right",
                              subio ? "text-alerta" : bajo ? "text-dato-verde" : "text-tinta-suave",
                            ].join(" ")}
                          >
                            {formatearVariacion(f.variacion_pct)}
                          </span>
                        </div>
                      </div>

                      {/*
                        Barra divergente con la linea de cero en el centro.

                        El par verde/terracota queda en la banda 6-8 de
                        separacion para daltonismo (medido: delta-E 7.5 en
                        deutan), que el metodo permite SOLO con codificacion
                        secundaria. La hay, y es doble: el lado respecto de la
                        linea central y el signo explicito en el numero.
                      */}
                      <div className="relative h-1.5 bg-papel-hundido rounded-full">
                        <div className="absolute inset-y-0 left-1/2 w-px bg-linea-fuerte" />
                        <div
                          className={[
                            "absolute inset-y-0",
                            subio
                              ? "left-1/2 bg-alerta rounded-r-full"
                              : bajo
                                ? "right-1/2 bg-dato-verde rounded-l-full"
                                : "hidden",
                          ].join(" ")}
                          style={{ width: `${(Math.abs(f.variacion_pct) / maximo) * 50}%` }}
                          role="presentation"
                        />
                      </div>
                    </button>

                    {estaAbierta && (
                      <div className="mt-2 mb-3">
                        <DetalleInflacionCadenas categoria={f.categoria} />
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>

            <p className="text-[11px] text-tinta-suave mt-4 pt-3 border-t border-linea leading-relaxed">
              La variacion de una categoria es la media geometrica de los factores encadenados de todas sus series de
              precios; sin datos de volumen de ventas no hay con que ponderar, asi que cada cadena pesa igual. Solo
              entran las series con la cadena de factores completa y las categorias cubiertas por al menos 3 cadenas:
              con una sola cadena el numero no es el mercado, es un supermercado.
            </p>
          </div>
        </>
      )}
    </div>
  );
}

export default InflacionPage;
