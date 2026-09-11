import { useEffect, useMemo, useState } from "react";
import { obtenerCanasta } from "../api/client";
import { nombreProvincia } from "../utils/provincias";
import { normalizar } from "../utils/texto";
import { fechaEnPalabras, formatearNumero, formatearPesos } from "../utils/formato";
import Titular, { Resaltado } from "../components/Titular";
import FilaDeCifras from "../components/FilaDeCifras";
import TiraDePuntos from "../components/TiraDePuntos";
import DetalleCanasta from "../components/DetalleCanasta";
import type { Canasta } from "../types";

/*
  Canasta basica: cuanto cuesta comer en cada localidad.

  La pagina abre con la brecha, que es el hallazgo, y no con el nombre de la
  seccion: la metodologia sigue completa en la bajada, donde la busca quien
  quiere auditarla. La tira de puntos muestra todas las localidades a la vez,
  asi se ve que la brecha no son dos casos raros sino una distribucion.

  Una sola consulta y el filtrado en el navegador. Antes cada texto tipeado en
  el buscador era una consulta nueva a BigQuery (cada busqueda distinta es una
  clave distinta en la cache), y con una cuota diaria ajustada eso es caro para
  filtrar 94 filas que ya estaban en el navegador.
*/

const TANDA = 50;

function CanastaPage() {
  const [estado, setEstado] = useState<{ filas?: Canasta[]; error?: string } | null>(null);
  const [busqueda, setBusqueda] = useState("");
  // Localidad cuyo desglose esta abierto. Se guarda una sola: dos desgloses
  // abiertos a la vez compiten por la atencion y no aportan.
  const [abierta, setAbierta] = useState<string | null>(null);
  const [mostradas, setMostradas] = useState(TANDA);

  useEffect(() => {
    let cancelado = false;
    obtenerCanasta({ limite: 2000 })
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

  // La API devuelve ordenado por costo ascendente.
  const todas = useMemo(() => estado?.filas ?? [], [estado]);
  const consulta = normalizar(busqueda.trim());
  const filas = useMemo(
    () =>
      consulta
        ? todas.filter(
            (f) =>
              normalizar(f.localidad).includes(consulta) ||
              normalizar(nombreProvincia(f.provincia)).includes(consulta)
          )
        : todas,
    [todas, consulta]
  );

  // Volver al principio de la lista cuando cambia el filtro, derivandolo del
  // estado anterior en vez de setearlo dentro de un efecto.
  const [consultaPrevia, setConsultaPrevia] = useState(consulta);
  if (consultaPrevia !== consulta) {
    setConsultaPrevia(consulta);
    setMostradas(TANDA);
  }

  const masBarata = todas[0];
  const masCara = todas[todas.length - 1];
  const mediana = todas.length > 0 ? todas[Math.floor(todas.length / 2)] : undefined;
  const brecha =
    masBarata && masCara && masBarata.costo_canasta_total > 0
      ? ((masCara.costo_canasta_total - masBarata.costo_canasta_total) / masBarata.costo_canasta_total) * 100
      : 0;

  const lote = filas.slice(0, mostradas);
  const faltan = filas.length - lote.length;
  // Constante por construccion: el mart solo emite localidades con la canasta
  // entera. Se muestra para que el lector pueda auditar sobre que se compara.
  const categorias = todas[0]?.categorias_en_canasta ?? 0;
  const nombreDe = (c: Canasta) => `${c.localidad}, ${nombreProvincia(c.provincia)}`;
  const claveDe = (c: Canasta) => `${c.localidad}|${c.provincia}`;

  return (
    <div className="max-w-4xl mx-auto">
      <Titular
        antetitulo={
          todas.length > 0
            ? [
                `Canasta basica`,
                `${categorias} categorias`,
                `${formatearNumero(todas.length)} localidades`,
                fechaEnPalabras(masBarata.fecha_datos) && `precios del ${fechaEnPalabras(masBarata.fecha_datos)}`,
              ]
                .filter(Boolean)
                .join(" · ")
            : "Canasta basica"
        }
        bajada={
          masBarata ? (
            <>
              <p>
                Es la canasta alimentaria del INDEC, adaptada: las mismas {categorias} categorias y las mismas
                cantidades en todas las localidades. Solo entran las localidades donde se puede medir la canasta
                completa, porque sumar las categorias que cada una tenga haria parecer mas baratas a las que tienen
                menos datos. Si a una le faltan observaciones de una categoria se usa la mediana de su provincia, en
                hasta 2 de las {categorias}.
              </p>
            </>
          ) : null
        }
      >
        {masBarata && masCara ? (
          <>
            {/* El espacio duro evita que la cifra y su unidad queden en lineas distintas. */}
            Llenar la misma canasta cuesta <Resaltado>{brecha.toFixed(0)}%&nbsp;mas</Resaltado> en{" "}
            {masCara.localidad} que en {masBarata.localidad}
          </>
        ) : (
          "Cuanto cuesta la canasta basica en cada localidad"
        )}
      </Titular>

      {estado === null && <p className="text-sm text-tinta-suave">Cargando…</p>}

      {estado?.error && (
        <p className="text-sm text-alerta bg-alerta-tenue border border-alerta/20 rounded-lg px-3 py-2">
          No se pudo cargar: {estado.error}
        </p>
      )}

      {todas.length > 0 && masBarata && masCara && (
        <>
          <div className="mb-6">
            <TiraDePuntos
              puntos={todas.map((c) => ({ id: claveDe(c), valor: c.costo_canasta_total, nombre: nombreDe(c) }))}
              formatear={formatearPesos}
              elegido={abierta ?? (filas.length === 1 ? claveDe(filas[0]) : undefined)}
              descripcion={`Costo de la canasta en ${todas.length} localidades, de ${formatearPesos(
                masBarata.costo_canasta_total
              )} a ${formatearPesos(masCara.costo_canasta_total)}`}
            />
          </div>

          <div className="mb-8">
            <FilaDeCifras
              cifras={[
                {
                  etiqueta: "Mas barata",
                  valor: formatearPesos(masBarata.costo_canasta_total),
                  detalle: nombreDe(masBarata),
                },
                ...(mediana
                  ? [
                      {
                        etiqueta: "Mediana",
                        valor: formatearPesos(mediana.costo_canasta_total),
                        detalle: "la localidad del medio",
                      },
                    ]
                  : []),
                {
                  etiqueta: "Mas cara",
                  valor: formatearPesos(masCara.costo_canasta_total),
                  detalle: nombreDe(masCara),
                },
                { etiqueta: "Brecha", valor: `${brecha.toFixed(0)}%`, detalle: "entre los dos extremos" },
              ]}
            />
          </div>

          <input
            type="search"
            placeholder="Buscar localidad o provincia (ej: Tandil, Chubut)"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            aria-label="Buscar localidad"
            className="w-full bg-transparent border-b border-linea-fuerte px-0 py-2.5 text-sm mb-5 placeholder:text-tinta-suave focus:outline-none focus:border-ahorro"
          />

          {filas.length === 0 && (
            <p className="text-sm text-tinta-suave">Ninguna localidad medida coincide con esa busqueda.</p>
          )}

          {filas.length > 0 && (
            <div>
              <div className="flex items-baseline justify-between gap-3 pb-2 border-b border-linea-fuerte">
                <h2 className="text-xs font-semibold uppercase tracking-wider text-tinta-suave">Ranking por costo</h2>
                <span className="text-xs text-tinta-suave">
                  {consulta
                    ? `${formatearNumero(filas.length)} de ${formatearNumero(todas.length)}`
                    : "de menor a mayor"}
                </span>
              </div>

              <ul>
                {lote.map((c) => {
                  // La posicion es la del ranking completo, no la del filtro: si
                  // alguien busca su localidad, lo que quiere saber es en que
                  // lugar quedo entre todas.
                  const posicion = todas.indexOf(c) + 1;
                  // Barra con el minimo del conjunto como origen: partir de cero
                  // aplastaria las diferencias, porque entre la mas barata y la
                  // mas cara hay menos de un factor dos.
                  const rango = masCara.costo_canasta_total - masBarata.costo_canasta_total;
                  const proporcion =
                    rango > 0 ? (c.costo_canasta_total - masBarata.costo_canasta_total) / rango : 0;
                  const clave = claveDe(c);
                  const estaAbierta = abierta === clave;

                  return (
                    <li key={clave} className="border-b border-linea">
                      <button
                        onClick={() => setAbierta(estaAbierta ? null : clave)}
                        aria-expanded={estaAbierta}
                        className={[
                          "w-full flex items-center gap-4 py-3 text-left transition-colors",
                          estaAbierta ? "bg-papel-hundido" : "hover:bg-papel-hundido",
                        ].join(" ")}
                      >
                        <span className="font-display text-lg text-tinta-suave w-9 shrink-0 text-right">
                          {posicion}
                        </span>

                        <span className="min-w-0 w-48 shrink-0">
                          <span className="block text-sm font-medium text-tinta truncate">{c.localidad}</span>
                          <span className="block text-xs text-tinta-suave truncate">
                            {nombreProvincia(c.provincia)}
                            {c.categorias_imputadas > 0 && (
                              <span title="Categorias valuadas con la mediana de la provincia, porque la localidad no junta suficientes observaciones">
                                {" "}
                                · {c.categorias_imputadas} con precio provincial
                              </span>
                            )}
                          </span>
                        </span>

                        <span className="flex-1 hidden sm:block">
                          <span
                            className="block h-1.5 rounded-r-full bg-escala-3"
                            style={{ width: `${6 + proporcion * 94}%` }}
                            role="presentation"
                          />
                        </span>

                        <span className="text-right shrink-0 w-28">
                          <span className="numero block text-sm font-semibold text-tinta">
                            {formatearPesos(c.costo_canasta_total)}
                          </span>
                          {posicion > 1 && (
                            <span className="numero block text-xs text-tinta-suave">
                              +{formatearPesos(c.costo_canasta_total - masBarata.costo_canasta_total)}
                            </span>
                          )}
                        </span>

                        <span className="text-tinta-suave text-xs shrink-0 w-4" aria-hidden="true">
                          {estaAbierta ? "−" : "+"}
                        </span>
                      </button>

                      {estaAbierta && (
                        <div className="pb-4">
                          <DetalleCanasta
                            localidad={c.localidad}
                            provincia={c.provincia}
                            total={c.costo_canasta_total}
                          />
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>

              {faltan > 0 && (
                <button
                  onClick={() => setMostradas(mostradas + TANDA)}
                  className="w-full py-3 text-sm font-medium text-tinta-media hover:bg-papel-hundido border-b border-linea transition-colors"
                >
                  Ver {Math.min(TANDA, faltan)} localidades mas
                  <span className="numero text-tinta-suave"> ({formatearNumero(faltan)} restantes)</span>
                </button>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default CanastaPage;
