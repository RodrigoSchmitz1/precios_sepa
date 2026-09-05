import { useState, useEffect } from "react";
import MapaPromos from "../components/MapaPromos";
import type { BoundingBox } from "../components/MapaPromos";
import PromoCard from "../components/PromoCard";
import Filtros from "../components/Filtros";
import { obtenerPromosMapa } from "../api/client";
import type { PromoMapa } from "../types";

function PromosPage() {
  const [promos, setPromos] = useState<PromoMapa[]>([]);
  const [hayMas, setHayMas] = useState(false);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [busqueda, setBusqueda] = useState("");
  const [provincia, setProvincia] = useState("");
  const [bbox, setBbox] = useState<BoundingBox | null>(null);

  useEffect(() => {
    if (!bbox) return;

    setCargando(true);

    const timeoutId = setTimeout(() => {
      obtenerPromosMapa({ busqueda, provincia, limite: 2000, bbox })
        .then((respuesta) => {
          setPromos(respuesta.promos);
          setHayMas(respuesta.hay_mas);
          setCargando(false);
        })
        .catch((err) => {
          setError(err.message);
          setCargando(false);
        });
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [busqueda, provincia, bbox]);

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

      <div className="mb-8">
        <MapaPromos promos={promos} onMoverMapa={setBbox} />
        <p className="text-xs text-gray-400 mt-2">
          Movete o haces zoom en el mapa para ver las promos de otra zona.
        </p>
      </div>

      {cargando && <p className="text-gray-500">Cargando promos...</p>}
      {error && <p className="text-red-500">Error al cargar: {error}</p>}

      {!cargando && !error && promos.length === 0 && (
        <p className="text-gray-500">No se encontraron promos en esta zona.</p>
      )}

      {!cargando && !error && hayMas && (
        <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-md px-3 py-2 mb-4">
          Mostrando las {promos.length} promos con mayor descuento de esta zona. Acerca el mapa para ver mas.
        </p>
      )}

      <div className="grid gap-4">
        {promos.map((promo, i) => (
          <PromoCard
            key={i}
            promo={{
              descripcion: promo.descripcion,
              marca: promo.marca,
              categoria: promo.categoria,
              rubro: promo.rubro,
              cadena: promo.cadena,
              provincia: promo.provincia,
              precio_lista: promo.precio_lista,
              precio_promo: promo.precio_promo,
              descuento_pct: promo.descuento_pct,
              leyenda: promo.leyenda,
              sucursales_con_esta_promo: 1,
            }}
          />
        ))}
      </div>
    </div>
  );
}

export default PromosPage;
