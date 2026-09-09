import { useState, useEffect } from "react";
import { obtenerCanasta } from "../api/client";
import { nombreProvincia } from "../utils/provincias";
import { formatearPesos, formatearNumero } from "../utils/formato";
import TileKPI from "../components/TileKPI";
import DetalleCanasta from "../components/DetalleCanasta";
import type { Canasta } from "../types";

const TANDA = 50;

/*
  Se guarda junto al resultado la busqueda que lo produjo. Con eso el estado de
  "cargando" se DERIVA (lo cargado no corresponde a lo que se esta pidiendo) en
  vez de setearse dentro del efecto, lo que evita el render encadenado que marca
  react-hooks/set-state-in-effect y, sobre todo, impide mostrar los resultados
  de una busqueda anterior como si fueran de la actual.
*/
type Estado = { busqueda: string; filas?: Canasta[]; error?: string };

function CanastaPage() {
  const [busqueda, setBusqueda] = useState("");
  const [estado, setEstado] = useState<Estado | null>(null);
  // Localidad cuyo desglose esta abierto. Se guarda una sola: dos desgloses
  // abiertos a la vez compiten por la atencion y no aportan.
  const [abierta, setAbierta] = useState<string | null>(null);

  useEffect(() => {
    let cancelado = false;

    const timeoutId = setTimeout(() => {
      obtenerCanasta({ busqueda, limite: 500 })
        .then((filas) => {
          if (!cancelado) setEstado({ busqueda, filas });
        })
        .catch((err) => {
          if (!cancelado) setEstado({ busqueda, error: err.message });
        });
    }, 300);

    return () => {
      cancelado = true;
      clearTimeout(timeoutId);
    };
  }, [busqueda]);

  const vigente = estado?.busqueda === busqueda ? estado : null;

  /*
    Se compara contra estado.filas, que es la referencia guardada en el estado y
    por lo tanto estable entre renders. Comparar contra "filas" (con el ?? [])
    generaba un array nuevo en cada render, la condicion daba siempre verdadera
    y el componente entraba en un bucle infinito de renders.
  */
  const filasCrudas = vigente?.filas;
  const [mostradas, setMostradas] = useState(TANDA);
  const [filasPrevias, setFilasPrevias] = useState(filasCrudas);
  if (filasPrevias !== filasCrudas) {
    setFilasPrevias(filasCrudas);
    setMostradas(TANDA);
  }

  const filas = filasCrudas ?? [];

  // La API devuelve ordenado por costo ascendente, asi que la primera y la
  // ultima son los extremos del conjunto que se esta mirando.
  const masBarata = filas[0];
  const masCara = filas[filas.length - 1];
  const brecha =
    masBarata && masCara && masBarata.costo_canasta_total > 0
      ? ((masCara.costo_canasta_total - masBarata.costo_canasta_total) /
          masBarata.costo_canasta_total) *
        100
      : 0;

  const lote = filas.slice(0, mostradas);
  const faltan = filas.length - lote.length;
  // Constante por construccion: el mart solo emite localidades con la canasta
  // entera. Se muestra para que el lector pueda auditar sobre que se compara.
  const canasta = filas[0]?.categorias_en_canasta ?? 0;

  return (
    <div className="max-w-4xl mx-auto">
      <header className="mb-6">
        <h1 className="font-display text-4xl text-tinta mb-2">Canasta basica</h1>
        <p className="text-tinta-media leading-relaxed">
          Costo mensual de una canasta basica alimentaria por localidad, con metodologia
          INDEC adaptada.{" "}
          {canasta > 0 && (
            <>
              Se comparan unicamente las localidades donde se puede medir la canasta
              <strong className="font-semibold text-tinta"> completa, las {canasta} categorias</strong>:
              sumar solo las categorias que cada localidad tiene haria parecer mas baratas
              a las que tienen menos datos.
            </>
          )}
        </p>
      </header>

      {filas.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-7">
          <TileKPI
            etiqueta="Mas barata"
            tono="verde"
            valor={formatearPesos(masBarata.costo_canasta_total)}
            detalle={`${masBarata.localidad}, ${nombreProvincia(masBarata.provincia)}`}
          />
          <TileKPI
            etiqueta="Mas cara"
            tono="ocre"
            valor={formatearPesos(masCara.costo_canasta_total)}
            detalle={`${masCara.localidad}, ${nombreProvincia(masCara.provincia)}`}
          />
          <TileKPI
            etiqueta="Brecha"
            tono="ciruela"
            valor={`${brecha.toFixed(0)}%`}
            detalle="mas cara la ultima que la primera"
          />
          <TileKPI
            etiqueta="Localidades"
            tono="azul"
            valor={formatearNumero(filas.length)}
            detalle="donde se puede medir la canasta completa"
          />
        </div>
      )}

      <input
        type="search"
        placeholder="Buscar localidad (ej: Tandil, Olavarria)"
        value={busqueda}
        onChange={(e) => setBusqueda(e.target.value)}
        aria-label="Buscar localidad"
        className="w-full bg-papel border border-linea rounded-xl px-4 py-2.5 text-sm mb-5 focus:outline-none focus:border-ahorro"
      />

      {vigente === null && <p className="text-sm text-tinta-suave">Cargando…</p>}

      {vigente?.error && (
        <p className="text-sm text-alerta bg-alerta-tenue border border-alerta/20 rounded-lg px-3 py-2">
          No se pudo cargar: {vigente.error}
        </p>
      )}

      {vigente?.filas && filas.length === 0 && (
        <p className="text-sm text-tinta-suave">No se encontraron localidades con ese nombre.</p>
      )}

      {filas.length > 0 && (
        <div className="bg-papel border border-linea rounded-2xl overflow-hidden">
          <div className="flex items-baseline justify-between gap-3 px-4 py-3 border-b border-linea">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-tinta-suave">
              Ranking por costo
            </h2>
            <span className="text-xs text-tinta-suave">de menor a mayor</span>
          </div>

          <ul>
            {lote.map((c, i) => {
              // Barra proporcional al costo, con el minimo del conjunto como
              // origen: partir de cero aplastaria todas las diferencias, porque
              // entre la mas barata y la mas cara hay menos de un factor dos.
              const rango = masCara.costo_canasta_total - masBarata.costo_canasta_total;
              const proporcion =
                rango > 0 ? (c.costo_canasta_total - masBarata.costo_canasta_total) / rango : 0;
              const clave = `${c.localidad}|${c.provincia}`;
              const estaAbierta = abierta === clave;

              return (
                <li
                  key={`${c.localidad}-${c.provincia}`}
                  className="border-b border-linea last:border-0"
                >
                <button
                  onClick={() => setAbierta(estaAbierta ? null : clave)}
                  aria-expanded={estaAbierta}
                  className={[
                    "w-full flex items-center gap-4 px-4 py-2.5 text-left transition-colors",
                    estaAbierta ? "bg-papel-hundido" : "hover:bg-papel-hundido",
                  ].join(" ")}
                >
                  <span className="numero text-xs text-tinta-suave w-8 shrink-0 text-right">
                    {i + 1}
                  </span>

                  <div className="min-w-0 w-48 shrink-0">
                    <p className="text-sm font-medium text-tinta truncate">{c.localidad}</p>
                    <p className="text-xs text-tinta-suave truncate">
                      {nombreProvincia(c.provincia)}
                    </p>
                  </div>

                  {/* Marca fina, con la punta redondeada y anclada a la linea base */}
                  <div className="flex-1 hidden sm:block">
                    <div
                      className="h-2 rounded-r bg-escala-3"
                      style={{ width: `${8 + proporcion * 92}%` }}
                      role="presentation"
                    />
                  </div>

                  <div className="text-right shrink-0 w-28">
                    <p className="numero text-sm font-semibold text-tinta">
                      {formatearPesos(c.costo_canasta_total)}
                    </p>
                    {i > 0 && (
                      <p className="numero text-xs text-tinta-suave">
                        +{formatearPesos(c.costo_canasta_total - masBarata.costo_canasta_total)}
                      </p>
                    )}
                  </div>

                  <span
                    className="text-tinta-suave text-xs shrink-0 w-4"
                    aria-hidden="true"
                  >
                    {estaAbierta ? "−" : "+"}
                  </span>
                </button>

                {estaAbierta && (
                  <div className="px-4 pb-4">
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
              className="w-full px-4 py-3 text-sm font-medium text-tinta-media hover:bg-papel-hundido border-t border-linea transition-colors"
            >
              Ver {Math.min(TANDA, faltan)} localidades mas
              <span className="numero text-tinta-suave"> ({formatearNumero(faltan)} restantes)</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default CanastaPage;
