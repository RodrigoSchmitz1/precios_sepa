import { useState, useEffect } from "react";
import { obtenerInflacion, obtenerCategoriasInflacion } from "../api/client";
import type { Inflacion } from "../types";

function InflacionPage() {
  const [categorias, setCategorias] = useState<string[]>([]);
  const [categoriaElegida, setCategoriaElegida] = useState("");
  const [resultados, setResultados] = useState<Inflacion[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    obtenerCategoriasInflacion()
      .then((lista) => {
        setCategorias(lista);
        if (lista.length > 0) setCategoriaElegida(lista[0]);
      })
      .catch((err) => setError(err.message));
  }, []);

  useEffect(() => {
    if (!categoriaElegida) return;
    setCargando(true);
    obtenerInflacion(categoriaElegida)
      .then((datos) => {
        setResultados(datos);
        setCargando(false);
      })
      .catch((err) => {
        setError(err.message);
        setCargando(false);
      });
  }, [categoriaElegida]);

  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-3xl font-bold text-gray-900 mb-2">Inflacion por categoria</h1>
      <p className="text-sm text-gray-500 mb-1">
        Variacion de precios por cadena, calculada comparando la primera y la
        ultima fecha registradas en el historico.
      </p>
      <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-md px-3 py-2 mb-6">
        El historico recien empezo a acumularse. Con pocos dias de datos, las
        variaciones no son representativas de una inflacion mensual real
        todavia - el dato se vuelve mas util con el tiempo.
      </p>

      <select
        value={categoriaElegida}
        onChange={(e) => setCategoriaElegida(e.target.value)}
        className="border border-gray-300 rounded-md px-3 py-2 text-sm mb-6 focus:outline-none focus:ring-2 focus:ring-green-500"
      >
        {categorias.map((cat) => (
          <option key={cat} value={cat}>
            {cat}
          </option>
        ))}
      </select>

      {cargando && <p className="text-gray-500">Cargando...</p>}
      {error && <p className="text-red-500">Error: {error}</p>}

      {!cargando && !error && resultados.length > 0 && (
        <p className="text-xs text-gray-400 mb-4">
          Periodo: {resultados[0].fecha_inicio} a {resultados[0].fecha_fin}
        </p>
      )}

      <div className="space-y-2">
        {resultados.map((r) => (
          <div
            key={r.cadena}
            className="bg-white rounded-lg shadow-sm border border-gray-200 p-3 flex justify-between items-center"
          >
            <span className="text-sm text-gray-700">{r.cadena}</span>
            <span
              className={
                r.variacion_pct > 0
                  ? "text-sm font-semibold text-red-600"
                  : r.variacion_pct < 0
                    ? "text-sm font-semibold text-green-600"
                    : "text-sm font-semibold text-gray-400"
              }
            >
              {r.variacion_pct > 0 ? "+" : ""}
              {r.variacion_pct}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default InflacionPage;
