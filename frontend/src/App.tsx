import { useState, useEffect } from "react";

type Promo = {
  descripcion: string;
  marca: string;
  categoria: string | null;
  rubro: string | null;
  cadena: string;
  provincia: string;
  precio_lista: number;
  precio_promo: number;
  descuento_pct: number;
  leyenda: string;
  sucursales_con_esta_promo: number;
};

function App() {
  const [promos, setPromos] = useState<Promo[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("http://127.0.0.1:8000/promos?limite=20")
      .then((respuesta) => respuesta.json())
      .then((datos) => {
        setPromos(datos);
        setCargando(false);
      })
      .catch((err) => {
        setError(err.message);
        setCargando(false);
      });
  }, []);

  if (cargando) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">Cargando promos...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-red-500">Error al cargar: {error}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-10 px-4">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-6">
          Promos vigentes
        </h1>

        <div className="grid gap-4">
          {promos.map((promo, i) => (
            <div
              key={i}
              className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 flex justify-between items-center"
            >
              <div>
                <p className="font-semibold text-gray-900">
                  {promo.descripcion}
                </p>
                <p className="text-sm text-gray-500">
                  {promo.marca} · {promo.cadena} · {promo.provincia}
                </p>
                <p className="text-xs text-gray-400 mt-1">{promo.leyenda}</p>
              </div>

              <div className="text-right shrink-0 ml-4">
                <p className="text-sm text-gray-400 line-through">
                  ${promo.precio_lista}
                </p>
                <p className="text-lg font-bold text-green-600">
                  ${promo.precio_promo}
                </p>
                <span className="inline-block mt-1 text-xs font-semibold text-white bg-green-600 rounded-full px-2 py-0.5">
                  {promo.descuento_pct}% OFF
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default App;
