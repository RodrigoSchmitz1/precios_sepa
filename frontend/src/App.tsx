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

const PROVINCIAS: { codigo: string; nombre: string }[] = [
  { codigo: "", nombre: "Todas las provincias" },
  { codigo: "AR-B", nombre: "Buenos Aires" },
  { codigo: "AR-C", nombre: "CABA" },
  { codigo: "AR-X", nombre: "Cordoba" },
  { codigo: "AR-S", nombre: "Santa Fe" },
  { codigo: "AR-M", nombre: "Mendoza" },
  { codigo: "AR-U", nombre: "Chubut" },
];

function App() {
  const [promos, setPromos] = useState<Promo[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [busqueda, setBusqueda] = useState("");
  const [provincia, setProvincia] = useState("");

  useEffect(() => {
    setCargando(true);

    const params = new URLSearchParams();
    params.set("limite", "20");
    if (busqueda.trim()) params.set("busqueda", busqueda.trim());
    if (provincia) params.set("provincia", provincia);

    const timeoutId = setTimeout(() => {
      fetch(`http://127.0.0.1:8000/promos?${params.toString()}`)
        .then((respuesta) => respuesta.json())
        .then((datos) => {
          setPromos(datos);
          setCargando(false);
        })
        .catch((err) => {
          setError(err.message);
          setCargando(false);
        });
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [busqueda, provincia]);

  return (
    <div className="min-h-screen bg-gray-50 py-10 px-4">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-6">
          Promos vigentes
        </h1>

        <div className="flex gap-3 mb-6">
          <input
            type="text"
            placeholder="Buscar producto (ej: colchoneta, vino, yerba)"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="flex-1 border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          />
          <select
            value={provincia}
            onChange={(e) => setProvincia(e.target.value)}
            className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          >
            {PROVINCIAS.map((p) => (
              <option key={p.codigo} value={p.codigo}>
                {p.nombre}
              </option>
            ))}
          </select>
        </div>

        {cargando && <p className="text-gray-500">Cargando promos...</p>}
        {error && <p className="text-red-500">Error al cargar: {error}</p>}

        {!cargando && !error && promos.length === 0 && (
          <p className="text-gray-500">No se encontraron promos con esos filtros.</p>
        )}

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
