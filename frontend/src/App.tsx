import { useState, useEffect } from "react";
import MapaPromos from "./components/MapaPromos";
import PromoCard from "./components/PromoCard";
import Filtros from "./components/Filtros";

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

type PromoMapa = {
  descripcion: string;
  marca: string;
  cadena: string;
  nombre_sucursal: string;
  calle: string;
  numero: string;
  localidad: string;
  provincia: string;
  latitud: number;
  longitud: number;
  precio_lista: number;
  precio_promo: number;
  descuento_pct: number;
  leyenda: string;
};

function App() {
  const [promos, setPromos] = useState<Promo[]>([]);
  const [promosMapa, setPromosMapa] = useState<PromoMapa[]>([]);
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

    const paramsMapa = new URLSearchParams();
    paramsMapa.set("limite", "300");
    if (busqueda.trim()) paramsMapa.set("busqueda", busqueda.trim());
    if (provincia) paramsMapa.set("provincia", provincia);

    const timeoutId = setTimeout(() => {
      Promise.all([
        fetch(`http://127.0.0.1:8000/promos?${params.toString()}`).then((r) => r.json()),
        fetch(`http://127.0.0.1:8000/promos/mapa?${paramsMapa.toString()}`).then((r) => r.json()),
      ])
        .then(([listaPromos, listaMapa]) => {
          setPromos(listaPromos);
          setPromosMapa(listaMapa);
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

        <Filtros
          busqueda={busqueda}
          onBusquedaChange={setBusqueda}
          provincia={provincia}
          onProvinciaChange={setProvincia}
        />

        {cargando && <p className="text-gray-500">Cargando promos...</p>}
        {error && <p className="text-red-500">Error al cargar: {error}</p>}

        {!cargando && !error && promosMapa.length > 0 && (
          <div className="mb-8">
            <MapaPromos promos={promosMapa} />
          </div>
        )}

        {!cargando && !error && promos.length === 0 && (
          <p className="text-gray-500">No se encontraron promos con esos filtros.</p>
        )}

        <div className="grid gap-4">
          {promos.map((promo, i) => (
            <PromoCard key={i} promo={promo} />
          ))}
        </div>
      </div>
    </div>
  );
}

export default App;
