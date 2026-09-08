import { useState, useEffect } from "react";
import { obtenerCanasta } from "../api/client";
import { nombreProvincia } from "../utils/provincias";
import { formatearPesos } from "../utils/formato";
import type { Canasta } from "../types";

/*
  Se guarda junto al resultado la busqueda que lo produjo. Con eso el estado de
  "cargando" se DERIVA (lo cargado no corresponde a lo que se esta pidiendo) en
  vez de setearse dentro del efecto, lo cual evita el render encadenado que
  marca react-hooks/set-state-in-effect y, sobre todo, impide mostrar los
  resultados de una busqueda anterior como si fueran de la actual.
*/
type Estado = { busqueda: string; filas?: Canasta[]; error?: string };

function CanastaPage() {
  const [busqueda, setBusqueda] = useState("");
  const [estado, setEstado] = useState<Estado | null>(null);

  useEffect(() => {
    let cancelado = false;

    const timeoutId = setTimeout(() => {
      obtenerCanasta({ busqueda, limite: 50 })
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
  const filas = vigente?.filas ?? [];
  const masBarata = filas[0]?.costo_canasta_total;

  return (
    <div className="max-w-3xl mx-auto">
      <header className="mb-6">
        <h1 className="font-display text-4xl text-tinta mb-2">Canasta basica</h1>
        <p className="text-tinta-media leading-relaxed">
          Costo mensual de una canasta basica alimentaria por localidad, con metodologia
          INDEC adaptada. Solo aparecen las localidades con datos suficientes para un
          calculo confiable.
        </p>
      </header>

      <input
        type="search"
        placeholder="Buscar localidad (ej: Tandil, Olavarria)"
        value={busqueda}
        onChange={(e) => setBusqueda(e.target.value)}
        aria-label="Buscar localidad"
        className="w-full bg-papel border border-linea rounded-xl px-4 py-2.5 text-sm mb-6 focus:outline-none focus:border-ahorro"
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

      <div className="grid gap-2">
        {filas.map((c, i) => (
          <div
            key={`${c.localidad}-${c.provincia}`}
            className="bg-papel rounded-xl border border-linea p-4 flex items-center justify-between gap-4"
          >
            <div className="flex items-center gap-3.5 min-w-0">
              <span className="numero text-sm text-tinta-suave w-6 shrink-0 text-right">{i + 1}</span>
              <div className="min-w-0">
                <p className="font-semibold text-tinta truncate">{c.localidad}</p>
                <p className="text-xs text-tinta-suave">
                  {nombreProvincia(c.provincia)} · {c.categorias_disponibles} categorias
                </p>
              </div>
            </div>

            <div className="text-right shrink-0">
              <p className="numero text-lg font-bold text-tinta">
                {formatearPesos(c.costo_canasta_total)}
              </p>
              {/*
                La diferencia contra la mas barata es el dato que hace util al
                ranking: solo con el importe no se sabe si estar 20 puestos mas
                abajo cuesta mil pesos o cuarenta mil.
              */}
              {masBarata !== undefined && i > 0 && (
                <p className="numero text-xs text-alerta">
                  +{formatearPesos(c.costo_canasta_total - masBarata)}
                </p>
              )}
              {i === 0 && <p className="text-xs text-ahorro font-medium">la mas barata</p>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default CanastaPage;
