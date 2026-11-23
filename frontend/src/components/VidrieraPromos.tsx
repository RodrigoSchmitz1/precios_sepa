import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router";
import TarjetaPromoChica from "./TarjetaPromoChica";
import BloqueAvisos from "./BloqueAvisos";
import { obtenerVidriera } from "../api/client";
import { useZona } from "../contexto/zona";
import type { PromoVidriera, Vidriera } from "../types";
import { formatearNumero } from "../utils/formato";
import { nombreRubro } from "../utils/nombres";
import { textoPocoInforman } from "../utils/promosDeLista";
import { rotuloZona } from "../utils/zona";

/** Cuantas categorias se ven de entrada; el resto, detras de "Ver todas las categorias". */
const CATEGORIAS_A_LA_VISTA = 6;

/*
  La portada de Promos como vidriera (openspec promos-navegables-y-mes-en-gastos):
  tus avisos, las promos fuertes del dia y filas por categoria y por super. Una
  sola respuesta chica de la API en vez de las 5000 promos del mapa, que queda
  detras de "Ver en el mapa".
*/
function VidrieraPromos() {
  const { zona, lista } = useZona();
  const navigate = useNavigate();
  const [vidriera, setVidriera] = useState<Vidriera | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [todasLasCategorias, setTodasLasCategorias] = useState(false);
  const [busqueda, setBusqueda] = useState("");

  // Se espera a saber si hay zona: si no, se pediria la del pais y enseguida la de la zona.
  const firma = lista ? (zona ? `${zona.latitud},${zona.longitud}` : "pais") : "";
  const [firmaPedida, setFirmaPedida] = useState("");
  if (firma !== firmaPedida) {
    setFirmaPedida(firma);
    setVidriera(null);
    setError(null);
  }

  useEffect(() => {
    if (!firma) return;
    let cancelado = false;
    obtenerVidriera(zona)
      .then((v) => {
        if (!cancelado) setVidriera(v);
      })
      .catch((e) => {
        if (!cancelado) setError(e.message);
      });
    return () => {
      cancelado = true;
    };
  }, [firma, zona]);

  function buscar(e: FormEvent) {
    e.preventDefault();
    const texto = busqueda.trim();
    navigate(texto ? `?mapa=1&q=${encodeURIComponent(texto)}` : "?mapa=1");
  }

  const donde = zona ? `cerca de ${rotuloZona(zona)}` : "en todo el país";
  const categorias = vidriera?.categorias ?? [];
  const aLaVista = todasLasCategorias ? categorias : categorias.slice(0, CATEGORIAS_A_LA_VISTA);

  return (
    <div>
      <BloqueAvisos zona={zona} />

      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <form role="search" onSubmit={buscar} className="relative flex-1">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-tinta-suave text-base" aria-hidden="true">
            ⌕
          </span>
          <input
            type="search"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar una promo (ej: yerba, aceite, pañales)"
            aria-label="Buscar una promo"
            className="w-full bg-papel rounded-2xl shadow-tarjeta pl-10 pr-4 py-3 text-base sm:text-sm placeholder:text-tinta-suave focus:outline-none focus:ring-2 focus:ring-marca/40"
          />
        </form>
        <Link
          to="?mapa=1"
          className="shrink-0 inline-flex items-center justify-center gap-2 rounded-2xl border border-linea-fuerte bg-papel px-4 py-3 text-sm font-semibold text-tinta hover:bg-papel-hundido"
        >
          🗺️ Ver en el mapa
        </Link>
      </div>

      {!zona && lista && (
        <p className="mb-6 text-sm text-tinta-media bg-papel-hundido rounded-xl px-4 py-3">
          Estás viendo promos de todo el país. Elegí tu zona arriba para ver las de los súper que tenés cerca.
        </p>
      )}

      {error && (
        <p className="text-sm text-alerta bg-alerta-tenue border border-alerta/20 rounded-lg px-3 py-2">
          No se pudieron cargar las promos: {error}
        </p>
      )}
      {!vidriera && !error && <p className="text-sm text-tinta-suave">Cargando promos…</p>}

      {vidriera && vidriera.total === 0 && (
        <p className="text-sm text-tinta-suave">No encontramos promos vigentes {donde}. Probá con el mapa o con otra zona.</p>
      )}

      {vidriera && vidriera.fuertes.length > 0 && (
        <section aria-labelledby="titulo-fuertes" className="mb-10">
          <h2 id="titulo-fuertes" className="font-display text-2xl text-tinta">Las promos del día</h2>
          <p className="text-sm text-tinta-suave mb-3">
            Las de mayor descuento {donde}, con respaldo y en varias sucursales ·{" "}
            <span className="numero">{formatearNumero(vidriera.total)}</span> promos vigentes
          </p>
          {/* En el celular se deslizan de costado, como las filas; desde 640 px, grilla. */}
          <div className="flex gap-3 overflow-x-auto snap-x snap-mandatory pb-2 -mx-1 px-1 sm:grid sm:grid-cols-2 lg:grid-cols-4 sm:overflow-visible sm:mx-0 sm:px-0">
            {vidriera.fuertes.map((p, i) => (
              <TarjetaPromoChica key={`${p.id_producto}-${i}`} promo={p} clase="w-64 shrink-0 snap-start sm:w-auto" />
            ))}
          </div>
        </section>
      )}

      {aLaVista.length > 0 && (
        <section aria-labelledby="titulo-categorias" className="mb-10">
          <h2 id="titulo-categorias" className="font-display text-2xl text-tinta mb-3">Por categoría</h2>
          <div className="space-y-6">
            {aLaVista.map((c) => (
              <Fila
                key={c.slug}
                titulo={nombreRubro(c.rubro)}
                cantidad={c.cantidad}
                promos={c.promos}
                enlace={{ a: `/promos/${c.slug}`, texto: "Ver todas" }}
              />
            ))}
          </div>
          {categorias.length > CATEGORIAS_A_LA_VISTA && (
            <button
              type="button"
              onClick={() => setTodasLasCategorias(!todasLasCategorias)}
              className="mt-4 text-sm font-medium text-marca hover:underline"
            >
              {todasLasCategorias ? "Ver menos categorías" : `Ver todas las categorías (${categorias.length})`}
            </button>
          )}
        </section>
      )}

      {vidriera && (vidriera.cadenas.length > 0 || vidriera.poco_informan.length > 0) && (
        <section aria-labelledby="titulo-cadenas" className="mb-10">
          <h2 id="titulo-cadenas" className="font-display text-2xl text-tinta mb-3">Por súper</h2>
          <div className="space-y-6">
            {vidriera.cadenas.map((c) => (
              <Fila
                key={c.cadena}
                titulo={`Lo mejor de ${c.cadena} hoy`}
                cantidad={c.cantidad}
                promos={c.promos}
                enlace={{ a: "?mapa=1", texto: "Ver en el mapa" }}
              />
            ))}
          </div>
          {vidriera.poco_informan.length > 0 && (
            <p className="mt-4 text-xs text-tinta-suave">
              {textoPocoInforman(vidriera.poco_informan, vidriera.con_zona)}
            </p>
          )}
        </section>
      )}
    </div>
  );
}

function Fila({
  titulo,
  cantidad,
  promos,
  enlace,
}: {
  titulo: string;
  cantidad: number;
  promos: PromoVidriera[];
  enlace: { a: string; texto: string };
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3 mb-2">
        <h3 className="font-bold text-tinta min-w-0 truncate">
          {titulo}
          <span className="numero font-normal text-tinta-suave text-sm">
            {" · "}
            {formatearNumero(cantidad)} {cantidad === 1 ? "promo" : "promos"}
          </span>
        </h3>
        <Link to={enlace.a} className="shrink-0 text-sm font-medium text-marca hover:underline">
          {enlace.texto} →
        </Link>
      </div>
      {/* En el celular la fila se desliza de costado; el desborde queda adentro de la fila, no en la pagina. */}
      <div className="flex gap-3 overflow-x-auto snap-x snap-mandatory pb-2 -mx-1 px-1">
        {promos.map((p, i) => (
          <TarjetaPromoChica key={`${p.id_producto}-${i}`} promo={p} clase="w-60 shrink-0 snap-start" />
        ))}
      </div>
    </div>
  );
}

export default VidrieraPromos;
