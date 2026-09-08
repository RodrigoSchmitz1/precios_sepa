import { useState, useEffect, useMemo } from "react";
import MapaPromos from "../components/MapaPromos";
import type { BoundingBox } from "../components/MapaPromos";
import PromoCard from "../components/PromoCard";
import Filtros from "../components/Filtros";
import FiltroCategorias from "../components/FiltroCategorias";
import { obtenerPromosMapa } from "../api/client";
import type { PromoMapa } from "../types";
import { formatearNumero } from "../utils/formato";

const TANDA = 60;

function PromosPage() {
  const [promos, setPromos] = useState<PromoMapa[]>([]);
  const [hayMas, setHayMas] = useState(false);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [busqueda, setBusqueda] = useState("");
  const [provincia, setProvincia] = useState("");
  const [categoria, setCategoria] = useState<string | null>(null);
  const [bbox, setBbox] = useState<BoundingBox | null>(null);

  useEffect(() => {
    if (!bbox) return;

    // "cancelado" evita que una respuesta lenta pise a una posterior: moviendo
    // el mapa rapido se disparan varias consultas y la primera puede llegar
    // ultima, dejando en pantalla promos de una zona que ya no se esta viendo.
    let cancelado = false;

    const timeoutId = setTimeout(() => {
      // setCargando va adentro del timeout, no en el cuerpo del efecto: durante
      // los 300ms de espera todavia no se esta pidiendo nada, y ademas llamar a
      // setState sincronicamente en un efecto encadena renders (lo marca
      // react-hooks/set-state-in-effect).
      setCargando(true);
      obtenerPromosMapa({ busqueda, provincia, limite: 2000, bbox })
        .then((respuesta) => {
          if (cancelado) return;
          setPromos(respuesta.promos);
          setHayMas(respuesta.hay_mas);
          setError(null);
          setCargando(false);
        })
        .catch((err) => {
          if (cancelado) return;
          setError(err.message);
          setCargando(false);
        });
    }, 300);

    return () => {
      cancelado = true;
      clearTimeout(timeoutId);
    };
  }, [busqueda, provincia, bbox]);

  // El filtro por categoria es local: la respuesta ya trae la categoria de cada
  // promo, asi que no hace falta volver a consultar ni gastar una query mas.
  const promosVisibles = useMemo(
    () => (categoria ? promos.filter((p) => p.categoria === categoria) : promos),
    [promos, categoria]
  );

  /*
    Se renderiza de a tandas. La consulta trae hasta 2000 promos y pintarlas
    todas de golpe, con el mapa de Leaflet al lado, hace que la pagina se
    arrastre al scrollear.

    El reseteo se hace comparando durante el render y no con un useEffect: es el
    patron que recomienda React para ajustar estado cuando cambian los datos de
    entrada, evita el render extra del efecto y no dispara
    react-hooks/set-state-in-effect.
  */
  const [mostradas, setMostradas] = useState(TANDA);
  const [entradaPrevia, setEntradaPrevia] = useState({ categoria, promos });
  if (entradaPrevia.categoria !== categoria || entradaPrevia.promos !== promos) {
    setEntradaPrevia({ categoria, promos });
    setMostradas(TANDA);
  }

  const lote = promosVisibles.slice(0, mostradas);
  const faltan = promosVisibles.length - lote.length;

  return (
    <div className="max-w-5xl mx-auto">
      <header className="mb-6">
        <h1 className="font-display text-4xl text-tinta mb-2">Promos vigentes</h1>
        <p className="text-tinta-media">
          Descuentos publicados hoy por las cadenas. Movete por el mapa para ver los de tu zona.
        </p>
      </header>

      <div className="mb-5">
        <Filtros
          busqueda={busqueda}
          onBusquedaChange={setBusqueda}
          provincia={provincia}
          onProvinciaChange={setProvincia}
        />
      </div>

      <div className="mb-8">
        <div className="rounded-2xl overflow-hidden border border-linea">
          <MapaPromos promos={promos} onMoverMapa={setBbox} />
        </div>
        <p className="text-xs text-tinta-suave mt-2">
          Movete o haces zoom en el mapa para ver las promos de otra zona.
        </p>
      </div>

      <div className="grid lg:grid-cols-[13rem_1fr] gap-x-8 gap-y-6">
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <FiltroCategorias promos={promos} elegida={categoria} onElegir={setCategoria} />
        </aside>

        <div>
          <div className="flex items-baseline justify-between gap-3 mb-3">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-tinta-suave">
              {categoria ?? "Todas las promos"}
            </h2>
            {!cargando && !error && (
              <span className="numero text-xs text-tinta-suave">
                {formatearNumero(promosVisibles.length)}
                {promosVisibles.length === 1 ? " promo" : " promos"}
              </span>
            )}
          </div>

          {cargando && <p className="text-sm text-tinta-suave">Cargando promos…</p>}

          {error && (
            <p className="text-sm text-alerta bg-alerta-tenue border border-alerta/20 rounded-lg px-3 py-2">
              No se pudieron cargar las promos: {error}
            </p>
          )}

          {!cargando && !error && hayMas && (
            <p className="text-xs text-aviso bg-aviso-tenue border border-aviso/20 rounded-lg px-3 py-2 mb-4">
              Mostrando las {formatearNumero(promos.length)} promos con mayor descuento de esta zona.
              Acerca el mapa para ver mas.
            </p>
          )}

          {!cargando && !error && promosVisibles.length === 0 && (
            <p className="text-sm text-tinta-suave">
              {promos.length === 0
                ? "No se encontraron promos en esta zona."
                : `No hay promos de ${categoria} en esta zona.`}
            </p>
          )}

          <div className="grid gap-3">
            {lote.map((promo, i) => (
              <PromoCard key={`${promo.descripcion}-${promo.cadena}-${i}`} promo={promo} />
            ))}
          </div>

          {faltan > 0 && (
            <button
              onClick={() => setMostradas(mostradas + TANDA)}
              className="w-full mt-4 bg-papel border border-linea rounded-xl px-4 py-2.5 text-sm font-medium text-tinta-media hover:border-linea-fuerte hover:text-tinta transition-colors"
            >
              Ver {Math.min(TANDA, faltan)} promos mas
              <span className="numero text-tinta-suave"> ({formatearNumero(faltan)} restantes)</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default PromosPage;
