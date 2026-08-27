import { useState, useEffect } from "react";
import MapaPromos from "../components/MapaPromos";
import PromoCard from "../components/PromoCard";
import Filtros from "../components/Filtros";
import { obtenerPromos, obtenerPromosMapa } from "../api/client";
import type { Promo, PromoMapa } from "../types";

function PromosPage() {
  const [promos, setPromos] = useState<Promo[]>([]);
  const [promosMapa, setPromosMapa] = useState<PromoMapa[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [busqueda, setBusqueda] = useState("");
  const [provincia, setProvincia] = useState("");

  useEffect(() => {
    setCargando(true);

    const timeoutId = setTimeout(() => {
      Promise.all([
        obtenerPromos({ busqueda, provincia, limite: 20 }),
        obtenerPromosMapa({ busqueda, provincia, limite: 300 }),
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
  );
}

export default PromosPage;
