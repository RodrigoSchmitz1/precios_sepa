import { useState, useEffect } from "react";
import { obtenerQuienGana, obtenerCategoriasDisponibles } from "../api/client";
import type { QuienGana } from "../types";

function QuienGanaPage() {
  const [categorias, setCategorias] = useState<string[]>([]);
  const [categoriaElegida, setCategoriaElegida] = useState("");
  const [resultados, setResultados] = useState<QuienGana[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    obtenerCategoriasDisponibles()
      .then((lista) => {
        setCategorias(lista);
        if (lista.length > 0) setCategoriaElegida(lista[0]);
      })
      .catch((err) => setError(err.message));
  }, []);

  useEffect(() => {
    if (!categoriaElegida) return;
    setCargando(true);
    obtenerQuienGana(categoriaElegida)
      .then((datos) => {
        setResultados(datos);
        setCargando(false);
      })
      .catch((err) => {
        setError(err.message);
        setCargando(false);
      });
  }, [categoriaElegida]);

  const maximoVictorias = Math.max(...resultados.map((r) => r.pct_victorias), 1);

  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-3xl font-bold text-gray-900 mb-2">Quien gana</h1>
      <p className="text-sm text-gray-500 mb-6">
        Comparacion honesta: solo productos identicos (mismo codigo de barras)
        presentes en 2 o mas cadenas. Evita el sesgo de marca propia.
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
          Base: {resultados[0].total_productos_categoria} productos comparables
        </p>
      )}

      <div className="space-y-3">
        {resultados.map((r) => (
          <div key={r.cadena}>
            <div className="flex justify-between text-sm mb-1">
              <span className="text-gray-700">{r.cadena}</span>
              <span className="font-semibold text-gray-900">{r.pct_victorias}%</span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-3">
              <div
                className="bg-green-600 h-3 rounded-full"
                style={{ width: `${(r.pct_victorias / maximoVictorias) * 100}%` }}
              ></div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default QuienGanaPage;
