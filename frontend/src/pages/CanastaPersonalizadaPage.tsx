import { useState } from "react";
import {
  interpretarCanasta,
  calcularCanastaPersonalizada,
  buscarLocalidades,
} from "../api/client";
import type { ItemCanastaIA, ResultadoCanastaPersonalizada, LocalidadOpcion } from "../types";

function formatearPesos(valor: number): string {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(valor);
}

function CanastaPersonalizadaPage() {
  const [descripcion, setDescripcion] = useState("");
  const [items, setItems] = useState<ItemCanastaIA[]>([]);
  const [generando, setGenerando] = useState(false);
  const [errorGenerar, setErrorGenerar] = useState<string | null>(null);

  const [busquedaLocalidad, setBusquedaLocalidad] = useState("");
  const [opcionesLocalidad, setOpcionesLocalidad] = useState<LocalidadOpcion[]>([]);
  const [localidadesElegidas, setLocalidadesElegidas] = useState<string[]>([]);

  const [resultado, setResultado] = useState<ResultadoCanastaPersonalizada | null>(null);
  const [calculando, setCalculando] = useState(false);
  const [errorCalcular, setErrorCalcular] = useState<string | null>(null);

  function handleGenerar() {
    if (!descripcion.trim()) return;
    setGenerando(true);
    setErrorGenerar(null);
    setResultado(null);
    interpretarCanasta(descripcion)
      .then((r) => {
        setItems(r.items);
        setGenerando(false);
      })
      .catch((err) => {
        setErrorGenerar(err.message);
        setGenerando(false);
      });
  }

  function handleBuscarLocalidad(texto: string) {
    setBusquedaLocalidad(texto);
    if (texto.trim().length < 3) {
      setOpcionesLocalidad([]);
      return;
    }
    buscarLocalidades(texto).then(setOpcionesLocalidad).catch(() => setOpcionesLocalidad([]));
  }

  function agregarLocalidad(localidad: string) {
    if (!localidadesElegidas.includes(localidad) && localidadesElegidas.length < 3) {
      setLocalidadesElegidas([...localidadesElegidas, localidad]);
    }
    setBusquedaLocalidad("");
    setOpcionesLocalidad([]);
  }

  function quitarLocalidad(localidad: string) {
    setLocalidadesElegidas(localidadesElegidas.filter((l) => l !== localidad));
  }

  function quitarItem(categoria: string) {
    setItems(items.filter((i) => i.categoria !== categoria));
  }

  function handleCalcular() {
    if (items.length === 0 || localidadesElegidas.length === 0) return;
    setCalculando(true);
    setErrorCalcular(null);
    calcularCanastaPersonalizada(items, localidadesElegidas)
      .then((r) => {
        setResultado(r);
        setCalculando(false);
      })
      .catch((err) => {
        setErrorCalcular(err.message);
        setCalculando(false);
      });
  }

  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-3xl font-bold text-gray-900 mb-2">Tu canasta a medida</h1>
      <p className="text-sm text-gray-500 mb-6">
        Describi que consumis y una inteligencia artificial arma una canasta
        personalizada. Elegi tu zona y calculamos el costo real con datos de hoy.
      </p>

      <textarea
        value={descripcion}
        onChange={(e) => setDescripcion(e.target.value)}
        placeholder="Ej: somos una familia de 4, dos adultos y dos chicos chicos, comemos bastante carne y pollo, tomamos mate, presupuesto medio"
        rows={3}
        className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-green-500"
      />

      <button
        onClick={handleGenerar}
        disabled={generando || !descripcion.trim()}
        className="bg-green-600 text-white text-sm font-semibold px-4 py-2 rounded-md hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed mb-6"
      >
        {generando ? "Generando..." : "Generar canasta con IA"}
      </button>

      {errorGenerar && <p className="text-red-500 text-sm mb-4">Error: {errorGenerar}</p>}

      {items.length > 0 && (
        <>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Tu canasta</h2>
          <div className="grid gap-2 mb-6">
            {items.map((item) => (
              <div
                key={item.categoria}
                className="bg-white rounded-lg shadow-sm border border-gray-200 p-3 flex justify-between items-center"
              >
                <div>
                  <p className="text-sm font-semibold text-gray-900">
                    {item.categoria}{" "}
                    <span className="text-xs font-normal text-gray-400">
                      ({item.cantidad} {item.unidad}, {item.gama})
                    </span>
                  </p>
                  <p className="text-xs text-gray-500">{item.razon}</p>
                </div>
                <button
                  onClick={() => quitarItem(item.categoria)}
                  className="text-xs text-gray-400 hover:text-red-500 px-2"
                >
                  Quitar
                </button>
              </div>
            ))}
          </div>

          <h2 className="text-lg font-semibold text-gray-900 mb-2">Elegi tu zona (hasta 3 localidades)</h2>
          <input
            type="text"
            value={busquedaLocalidad}
            onChange={(e) => handleBuscarLocalidad(e.target.value)}
            placeholder="Buscar localidad o barrio..."
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm mb-2 focus:outline-none focus:ring-2 focus:ring-green-500"
          />
          {opcionesLocalidad.length > 0 && (
            <div className="border border-gray-200 rounded-md mb-3 max-h-40 overflow-y-auto">
              {opcionesLocalidad.map((op) => (
                <button
                  key={`${op.localidad}-${op.provincia}`}
                  onClick={() => agregarLocalidad(op.localidad)}
                  className="block w-full text-left text-sm px-3 py-2 hover:bg-gray-50"
                >
                  {op.localidad}
                </button>
              ))}
            </div>
          )}
          <div className="flex flex-wrap gap-2 mb-6">
            {localidadesElegidas.map((loc) => (
              <span
                key={loc}
                className="inline-flex items-center gap-1 bg-green-50 text-green-700 text-xs font-medium px-2 py-1 rounded-full"
              >
                {loc}
                <button onClick={() => quitarLocalidad(loc)} className="text-green-500 hover:text-green-800">
                  x
                </button>
              </span>
            ))}
          </div>

          <button
            onClick={handleCalcular}
            disabled={calculando || localidadesElegidas.length === 0}
            className="bg-green-600 text-white text-sm font-semibold px-4 py-2 rounded-md hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed mb-6"
          >
            {calculando ? "Calculando..." : "Calcular costo"}
          </button>
        </>
      )}

      {errorCalcular && <p className="text-red-500 text-sm mb-4">Error: {errorCalcular}</p>}

      {resultado && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <p className="text-2xl font-bold text-green-600 mb-1">
            {formatearPesos(resultado.costo_total)}
          </p>
          <p className="text-xs text-gray-400 mb-4">
            Calculado con {resultado.categorias_calculadas} de {resultado.categorias_pedidas} categorias pedidas
            {resultado.categorias_calculadas < resultado.categorias_pedidas &&
              " (algunas no tenian suficientes datos en tu zona)"}
          </p>
          <div className="space-y-1">
            {resultado.items.map((item) => (
              <div key={item.categoria} className="flex justify-between text-sm">
                <span className="text-gray-700">{item.categoria}</span>
                <span className="text-gray-900 font-medium">{formatearPesos(item.costo_categoria)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default CanastaPersonalizadaPage;
