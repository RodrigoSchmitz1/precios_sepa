import { useEffect, useMemo, useState } from "react";
import { obtenerIncidenciaCanasta, obtenerInflacionResumen } from "../api/client";
import CascadaCanasta from "../components/CascadaCanasta";
import DetalleInflacionCadenas from "../components/DetalleInflacionCadenas";
import Titular, { Resaltado } from "../components/Titular";
import FilaDeCifras from "../components/FilaDeCifras";
import { fechaEnPalabras, formatearVariacion, mesEnPalabras } from "../utils/formato";
import type { IncidenciaCanasta, InflacionResumen } from "../types";
import { nombreCategoria } from "../utils/nombres";

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

/** "2026-10-01" -> "2026-09": el mes anterior, en el formato que pide la API. */
function mesAnterior(iso: string): string {
  const [a, m] = iso.split("-").map(Number);
  return m === 1 ? `${a - 1}-12` : `${a}-${String(m - 1).padStart(2, "0")}`;
}

type Estado = { mes: string | null; filas?: InflacionResumen[]; error?: string };

function InflacionPage() {
  const [estado, setEstado] = useState<Estado | null>(null);
  const [abierta, setAbierta] = useState<string | null>(null);
  // null = el ultimo mes con datos, que es lo que la API devuelve sin parametro.
  const [mes, setMes] = useState<string | null>(null);
  // El ultimo mes se conoce recien con la primera respuesta.
  const [ultimoMes, setUltimoMes] = useState<string | null>(null);

  useEffect(() => {
    let cancelado = false;
    obtenerInflacionResumen(mes ?? undefined)
      .then((filas) => {
        if (cancelado) return;
        setEstado({ mes, filas });
        if (mes === null && filas[0]) setUltimoMes(filas[0].mes);
      })
      .catch((err) => {
        if (!cancelado) setEstado({ mes, error: err.message });
      });
    return () => {
      cancelado = true;
    };
  }, [mes]);

  // La cascada va aparte: si falla, el ranking se muestra igual.
  const [incidencia, setIncidencia] = useState<{ mes: string | null; datos: IncidenciaCanasta | null } | null>(null);
  useEffect(() => {
    let cancelado = false;
    obtenerIncidenciaCanasta(mes ?? undefined)
      .then((datos) => {
        if (!cancelado) setIncidencia({ mes, datos });
      })
      .catch(() => {
        if (!cancelado) setIncidencia({ mes, datos: null });
      });
    return () => {
      cancelado = true;
    };
  }, [mes]);
  const cascada = incidencia?.mes === mes ? incidencia.datos : null;

  const vigente = estado?.mes === mes ? estado : null;
  const filas = useMemo(() => vigente?.filas ?? [], [vigente]);
  const esElUltimo = mes === null;
  const nombreMes = filas[0] ? mesEnPalabras(filas[0].mes) : "";

  const resumen = useMemo(() => {
    if (filas.length === 0) return null;
    // El corte en 0,005 es el que usa el redondeo a dos decimales: por debajo,
    // la fila se imprime como "0,00%" y contarla entre las que subieron seria
    // contradecir lo que el lector ve.
    const subieron = filas.filter((f) => f.variacion_pct >= 0.005).length;
    const bajaron = filas.filter((f) => f.variacion_pct <= -0.005).length;
    /*
      El movimiento general, que es lo primero que uno quiere saber. Cada
      categoria es la media geometrica de sus series (cadena x unidad), asi que
      la media geometrica de las categorias ponderada por series es exactamente
      la de todas las series juntas: cada serie pesa lo mismo, como adentro de
      cada categoria. Hasta el 2026-09-24 el titulo solo contaba categorias
      ("42 de 49 subieron") y no decia cuanto.
    */
    const series = filas.reduce((n, f) => n + f.series, 0);
    const logs = filas.reduce((suma, f) => suma + f.series * Math.log(1 + f.variacion_pct / 100), 0);
    const general = series > 0 ? (Math.exp(logs / series) - 1) * 100 : 0;
    return {
      subieron,
      bajaron,
      quietas: filas.length - subieron - bajaron,
      dias: diasEntre(filas[0].fecha_inicio, filas[0].fecha_fin),
      general,
      series,
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
          filas.length > 0 ? `Inflación de ${nombreMes} · hasta el ${fechaEnPalabras(filas[0].fecha_fin)}` : "Inflación"
        }
        bajada={
          <>
            <p>
              La variación se mide sobre los productos presentes en las dos fechas y encadenando los cambios día a
              día: comparar el precio promedio de dos fechas sueltas mezclaría los cambios de precio con los cambios
              de surtido.
            </p>
            {resumen && (
              <p className="mt-2 text-sm text-sobre-oscuro-aviso">
                {filas[0].desde_inicio_de_mes
                  ? `${esElUltimo ? "Es lo que va" : "Es lo que fue"} de ${nombreMes}: ${resumen.dias} ${resumen.dias === 1 ? "día" : "días"} contra el cierre del mes anterior.`
                  : `Arranca el ${fechaEnPalabras(filas[0].fecha_inicio)}: antes faltan datos para encadenar, así que son ${resumen.dias} ${resumen.dias === 1 ? "día" : "días"} y no el mes entero.`}
              </p>
            )}
            {ultimoMes && (
              <div className="mt-3 flex gap-2" role="group" aria-label="Mes">
                {[mesAnterior(ultimoMes), null].map((opcion) => {
                  const elegido = opcion === mes;
                  return (
                    <button
                      key={opcion ?? "ultimo"}
                      type="button"
                      onClick={() => setMes(opcion)}
                      aria-pressed={elegido}
                      className={[
                        "text-sm rounded-full px-3 py-1 border transition-colors",
                        elegido ? "bg-papel text-tinta border-papel" : "border-sobre-oscuro-aviso/40 hover:bg-papel/10",
                      ].join(" ")}
                    >
                      {mesEnPalabras(opcion ?? ultimoMes)}
                    </button>
                  );
                })}
              </div>
            )}
          </>
        }
      >
        {resumen && masExtrema ? (
          <>
            {/*
              "En promedio" (2026-10-29): abajo la cascada dice cuanto subio la
              canasta, con otro numero (1,01% contra 1,76% el 28-10). Las dos
              estan bien, pero sin decir que esta es un promedio de todas las
              series se leian como una contradiccion.
            */}
            En promedio, los precios {resumen.general >= 0 ? "subieron" : "bajaron"}{" "}
            <Resaltado tono={resumen.general >= 0 ? undefined : "barato"}>
              {formatearVariacion(Math.abs(resumen.general)).replace("+", "")}
            </Resaltado>{" "}
            {esElUltimo ? `en lo que va de ${nombreMes}` : `en ${nombreMes}`}
          </>
        ) : (
          "Qué categorías subieron y cuáles bajaron"
        )}
      </Titular>

      {vigente?.error && (
        <p className="text-sm text-alerta bg-alerta-tenue border border-alerta/20 rounded-lg px-3 py-2">
          No se pudo cargar: {vigente.error}
        </p>
      )}

      {vigente === null && <p className="text-sm text-tinta-suave">Cargando…</p>}

      {vigente?.filas && filas.length === 0 && (
        <p className="text-sm text-tinta-suave">Todavía no hay dos fechas encadenables en el histórico.</p>
      )}

      {resumen && masExtrema && (
        <>
          <div className="mb-8">
            <FilaDeCifras
              cifras={[
                {
                  etiqueta: "General",
                  valor: formatearVariacion(resumen.general),
                  detalle: `promedio de ${resumen.series} series de precios, todas con el mismo peso`,
                },
                {
                  etiqueta: "Subieron",
                  valor: `${resumen.subieron} de ${filas.length}`,
                  detalle: `categorías; ${resumen.bajaron} bajaron`,
                },
                {
                  etiqueta: "Periodo",
                  valor: `${resumen.dias} ${resumen.dias === 1 ? "día" : "días"}`,
                  detalle: `de ${nombreMes}, hasta el ${fechaEnPalabras(filas[0].fecha_fin)}`,
                },
                {
                  etiqueta: "Mayor movimiento",
                  valor: formatearVariacion(masExtrema.variacion_pct),
                  detalle: nombreCategoria(masExtrema.categoria),
                },
              ]}
            />
          </div>

          {cascada && <CascadaCanasta datos={cascada} esElUltimo={esElUltimo} />}

          <div className="tarjeta p-4 sm:p-6">
            <div className="flex items-baseline justify-between gap-3 pb-3 border-b border-linea mb-2">
              <h2 className="font-display text-xl text-tinta">Todas las categorías</h2>
              <span className="text-xs text-tinta-suave">
                escala hasta {magnitudMaxima} ({nombreCategoria(masExtrema.categoria)})
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
                          {nombreCategoria(f.categoria)}
                        </span>
                        <div className="flex items-baseline gap-2.5 shrink-0">
                          {/*
                            La cobertura es lo que permite pesar cada linea: un
                            -2,87% sobre 3 empresas no vale lo mismo que un
                            +0,34% sobre 7, aunque las dos ocupen una fila. Se
                            muestran empresas y no cadenas (2026-10-28): Carne
                            vacuna tenia "7 cadenas" y son 3 empresas.
                          */}
                          <span
                            className="numero text-[11px] text-tinta-suave"
                            title={`Unas ${f.series} series de precios por día, de al menos ${f.empresas} empresas (${f.cadenas} cadenas) todos los días`}
                          >
                            {f.empresas} empresas
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
                        <DetalleInflacionCadenas categoria={f.categoria} mes={mes ?? undefined} />
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>

            <p className="text-[11px] text-tinta-suave mt-4 pt-3 border-t border-linea leading-relaxed">
              Cada día, la variación de una categoría es la media geométrica de los cambios de todas sus series de
              precios (cadena × unidad) que tienen datos ese día, y la del mes encadena esos cambios diarios. Sin datos
              de volumen de ventas no hay con qué ponderar, así que cada serie pesa igual. Solo entran las categorías
              con al menos 3 empresas todos los días, y las cadenas de una misma empresa (Carrefour, Market, Express y
              Maxi) cuentan como una: con una sola, el número no es el mercado, es un supermercado.
            </p>
          </div>
        </>
      )}
    </div>
  );
}

export default InflacionPage;
