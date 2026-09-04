import { useState, useEffect } from "react";
import { obtenerCanasta } from "../api/client";
import type { Canasta } from "../types";

function formatearPesos(valor: number): string {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(valor);
}

function CanastaPage() {
  const [busqueda, setBusqueda] = useState("");
  const [resultados, setResultados] = useState<Canasta[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setCargando(true);

    const timeoutId = setTimeout(() => {
      obtenerCanasta({ busqueda, limite: 50 })
        .then((datos) => {
          setResultados(datos);
          setCargando(false);
        })
        .catch((err) => {
          setError(err.message);
          setCargando(false);
        });
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [busqueda]);

  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-3xl font-bold text-gray-900 mb-2">Canasta basica</h1>
      <p className="text-sm text-gray-500 mb-6">
        Costo mensual de una canasta basica alimentaria (metodologia INDEC,
        adaptada) por localidad. Solo se muestran localidades con datos
        suficientes para un calculo confiable.
      </p>

      <input
        type="text"
        placeholder="Buscar localidad (ej: Tandil, Olavarria)"
        value={busqueda}
        onChange={(e) => setBusqueda(e.target.value)}
        className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm mb-6 focus:outline-none focus:ring-2 focus:ring-green-500"
      />

      {cargando && <p className="text-gray-500">Cargando...</p>}
      {error && <p className="text-red-500">Error: {error}</p>}

      {!cargando && !error && resultados.length === 0 && (
        <p className="text-gray-500">No se encontraron localidades con esos filtros.</p>
      )}

      <div className="grid gap-3">
        {resultados.map((c, i) => (
          <div
            key={`${c.localidad}-${c.provincia}`}
            className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 flex justify-between items-center"
          >
            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-400 w-6">{i + 1}</span>
              <div>
                <p className="font-semibold text-gray-900">{c.localidad}</p>
                <p className="text-xs text-gray-400">
                  {c.provincia} · {c.categorias_disponibles} categorias
                </p>
              </div>
            </div>
            <p className="text-lg font-bold text-green-600">
              {formatearPesos(c.costo_canasta_total)}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

export default CanastaPage;
