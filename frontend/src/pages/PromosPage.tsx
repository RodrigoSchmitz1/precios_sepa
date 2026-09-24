import { useState, useEffect, useMemo } from "react";
import MapaPromos from "../components/MapaPromos";
import type { BoundingBox, Destino } from "../components/MapaPromos";
import PromoCard from "../components/PromoCard";
import Presentacion from "../components/Presentacion";
import Filtros from "../components/Filtros";
import BuscadorProducto from "../components/BuscadorProducto";
import FilaDeCifras from "../components/FilaDeCifras";
import FiltroCategorias, { type Seleccion } from "../components/FiltroCategorias";
import { obtenerLugares, obtenerPromosMapa } from "../api/client";
import type { LugarMapa, PromoMapa, SucursalMapa } from "../types";
import { formatearNumero } from "../utils/formato";
import { EVIDENCIA, NIVELES_EVIDENCIA } from "../utils/evidencia";

const TANDA = 60;

type Orden = "sucursales" | "descuento";

/*
  Cuantas promos pide cada movida del mapa. Con 2000 (hasta el 2026-09-23) el
  corte dejaba solo los descuentos mas grandes, y esos son casi todos de
  Carrefour: en el Gran Buenos Aires se veian 92 promos de Dia de 493, 3 de La
  Anonima de 89 y 447 de Almacen de 1728, y solo en Palermo hay 5829. Se probo
  con 6000, el tope de la API, y el mapa se sentia lento al moverlo; 5000 cubre
  casi todo Palermo con 400 KB comprimidos.
*/
const PROMOS_POR_ZONA = 5000;

function PromosPage() {
  const [promos, setPromos] = useState<PromoMapa[]>([]);
  const [hayMas, setHayMas] = useState(false);
  const [sucursales, setSucursales] = useState<Record<string, SucursalMapa>>({});
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [busqueda, setBusqueda] = useState("");
  const [provincia, setProvincia] = useState("");
  const [filtro, setFiltro] = useState<Seleccion>(null);
  const [orden, setOrden] = useState<Orden>("sucursales");
  const [bbox, setBbox] = useState<BoundingBox | null>(null);
  const [lugares, setLugares] = useState<LugarMapa[]>([]);
  const [destino, setDestino] = useState<Destino | null>(null);

  // Si falla, el buscador de lugares queda sin sugerencias y el resto de la
  // pagina sigue andando: no vale la pena un cartel de error por esto.
  useEffect(() => {
    obtenerLugares()
      .then(setLugares)
      .catch(() => setLugares([]));
  }, []);

  function irALugar(lugar: LugarMapa) {
    setDestino({ latitud: lugar.latitud, longitud: lugar.longitud, zoom: 13 });
    // Con otra provincia elegida el mapa llegaria a una zona sin promos.
    if (provincia && lugar.provincia !== provincia) setProvincia("");
  }

  /*
    Elegir provincia ahora tambien lleva el mapa ahi, a su localidad con mas
    sucursales. Antes solo filtraba lo que ya estaba a la vista: mirando CABA y
    eligiendo Mendoza, el mapa quedaba vacio y decia que no habia promos.
  */
  function elegirProvincia(codigo: string) {
    setProvincia(codigo);
    const principal = lugares.find((l) => l.provincia === codigo);
    if (principal) setDestino({ latitud: principal.latitud, longitud: principal.longitud, zoom: 11 });
  }

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
      obtenerPromosMapa({ busqueda, provincia, limite: PROMOS_POR_ZONA, bbox })
        .then((respuesta) => {
          if (cancelado) return;
          setPromos(respuesta.promos);
          setHayMas(respuesta.hay_mas);
          setSucursales(respuesta.sucursales);
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

  // El filtro es local: la respuesta ya trae rubro y categoria de cada promo,
  // asi que no hace falta volver a consultar ni gastar una query mas.
  const promosVisibles = useMemo(() => {
    const filtradas = !filtro
      ? promos
      : filtro.tipo === "rubro"
        ? promos.filter((p) => (p.rubro ?? "Otros") === filtro.valor)
        : promos.filter((p) => p.categoria === filtro.valor);
    // La API las manda por descuento; "sucursales" las reordena aca, con el
    // descuento como desempate. sort es estable y se copia para no tocar promos.
    return orden === "descuento"
      ? filtradas
      : [...filtradas].sort((a, b) => b.total_sucursales - a.total_sucursales || b.descuento_pct - a.descuento_pct);
  }, [promos, filtro, orden]);

  /*
    Se renderiza de a tandas. La consulta trae hasta PROMOS_POR_ZONA promos y
    pintarlas todas de golpe, con el mapa de Leaflet al lado, hace que la pagina
    se arrastre al scrollear.

    El reseteo se hace comparando durante el render y no con un useEffect: es el
    patron que recomienda React para ajustar estado cuando cambian los datos de
    entrada, evita el render extra del efecto y no dispara
    react-hooks/set-state-in-effect.
  */
  const [mostradas, setMostradas] = useState(TANDA);
  const [entradaPrevia, setEntradaPrevia] = useState({ filtro, promos, orden });
  if (entradaPrevia.filtro !== filtro || entradaPrevia.promos !== promos || entradaPrevia.orden !== orden) {
    setEntradaPrevia({ filtro, promos, orden });
    setMostradas(TANDA);
  }

  const lote = promosVisibles.slice(0, mostradas);
  const faltan = promosVisibles.length - lote.length;

  // Resumen de lo que hay en la zona visible. La consulta devuelve ordenado por
  // descuento descendente, asi que la primera es la de mayor descuento.
  const mayorDescuento = promos.length > 0 ? Math.round(promos[0].descuento_pct) : 0;
  const cadenaDelMayor = promos.length > 0 ? promos[0].cadena : "";
  const cadenas = new Set(promos.map((p) => p.cadena)).size;
  const categoriasDistintas = new Set(promos.map((p) => p.categoria).filter(Boolean)).size;

  return (
    /*
      Mas ancha que las demas paginas (6xl contra 4xl). Esta es la unica que
      tiene barra de filtros al costado: con 5xl, la columna de la lista quedaba
      en 784px y las filas se leian apretadas mientras sobraban 128px de margen
      a cada lado. El ancho extra va entero a la lista.
    */
    <div className="max-w-6xl mx-auto">
      <Presentacion />

      {/*
        El titulo de la portada es la presentacion del sitio; las promos pasan a
        ser su primera seccion, asi que su encabezado baja a h2.
      */}
      <header className="mb-5 pt-8 border-t border-linea">
        <h2 className="font-display text-3xl text-tinta mb-2">Promos vigentes</h2>
        <p className="text-tinta-media">
          Descuentos publicados hoy por las cadenas. Movete por el mapa para ver los de tu zona.
        </p>
      </header>

      {/* Las cifras salen de las promos ya cargadas para el mapa: describen lo
          que se esta viendo y no cuestan una consulta extra. */}
      {promos.length > 0 && (
        <div className="mb-6">
          <FilaDeCifras
            cifras={[
              { etiqueta: "En esta zona", valor: formatearNumero(promos.length), detalle: "promos vigentes" },
              { etiqueta: "Mayor descuento", valor: `${mayorDescuento}%`, detalle: cadenaDelMayor },
              { etiqueta: "Cadenas", valor: formatearNumero(cadenas), detalle: "con promos aca" },
              { etiqueta: "Categorias", valor: formatearNumero(categoriasDistintas), detalle: "con al menos una promo" },
            ]}
          />
        </div>
      )}

      <div className="mb-5">
        <Filtros
          lugares={lugares}
          onElegirLugar={irALugar}
          provincia={provincia}
          onProvinciaChange={elegirProvincia}
        />
      </div>

      <div className="mb-8">
        <div className="rounded-xl overflow-hidden border border-linea">
          <MapaPromos promos={promos} sucursales={sucursales} onMoverMapa={setBbox} destino={destino} />
        </div>
        <p className="text-xs text-tinta-suave mt-2">
          Movete por el mapa para ver las promos de otra zona. Para hacer zoom con la ruedita, primero hace click en el mapa.
        </p>
      </div>

      <div className="mb-6">
        <BuscadorProducto busqueda={busqueda} onBusquedaChange={setBusqueda} />
      </div>

      {/*
        minmax(0,1fr) y no 1fr: el minimo implicito de una columna de grilla es
        auto, asi que la lista no podia achicarse por debajo del ancho de su
        contenido y empujaba la pagina hasta meter scroll horizontal. Con 5xl no
        se notaba porque sobraba margen; al ensanchar a 6xl quedo a la vista.

        En el celular pasaba lo mismo con la unica columna implicita: los rubros
        van en una linea con puntos suspensivos, y la columna crecia hasta el
        nombre mas largo. La pagina medía 829px en una pantalla de 375.
      */}
      <div className="grid grid-cols-[minmax(0,1fr)] lg:grid-cols-[13rem_minmax(0,1fr)] gap-x-8 gap-y-6">
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <FiltroCategorias promos={promos} elegido={filtro} onElegir={setFiltro} />
        </aside>

        <div>
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 mb-3">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-tinta-suave">
              {filtro?.valor ?? "Todas las promos"}
              {!cargando && !error && (
                <span className="numero normal-case tracking-normal font-normal">
                  {" · "}
                  {formatearNumero(promosVisibles.length)}
                  {promosVisibles.length === 1 ? " promo" : " promos"}
                </span>
              )}
            </h2>
            {/*
              Por defecto, las que estan en mas sucursales: ordenada solo por
              descuento, la lista arrancaba con una crema de manos al 70% en una
              sucursal, que casi nadie puede aprovechar.
            */}
            <div role="group" aria-label="Ordenar promos" className="inline-flex rounded-lg border border-linea bg-papel-hundido p-0.5">
              {(
                [
                  ["sucursales", "En mas sucursales"],
                  ["descuento", "Mayor descuento"],
                ] as const
              ).map(([valor, texto]) => (
                <button
                  key={valor}
                  type="button"
                  aria-pressed={orden === valor}
                  onClick={() => setOrden(valor)}
                  className={`px-2.5 py-1 text-xs rounded-md transition-colors ${
                    orden === valor ? "bg-papel text-tinta font-semibold shadow-sm" : "text-tinta-suave hover:text-tinta-media"
                  }`}
                >
                  {texto}
                </button>
              ))}
            </div>
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
                ? busqueda.trim()
                  ? `No hay promos de "${busqueda.trim()}" en esta zona.`
                  : "No se encontraron promos en esta zona."
                : `No hay promos de ${filtro?.valor} en esta zona.`}
            </p>
          )}

          {/*
            De donde sale el respaldo de cada promo. La etiqueta sola no
            alcanzaba: decir "verificado" invita a preguntar verificado por
            quien, y esa respuesta es justamente lo que separa a este listado de
            copiar los carteles de la gondola.

            Hasta el 2026-09-23 era un solo parrafo con las tres definiciones
            entre parentesis ("se sostiene frente al mismo producto en otras
            empresas", "no es inverosimil") y no se entendia. Ahora es una
            pregunta y una linea por etiqueta, en palabras de quien compra.
          */}
          <div className="text-xs text-tinta-media bg-papel-hundido rounded-lg px-3 py-2.5 mb-4 leading-relaxed">
            <p className="font-semibold text-tinta">Como sabemos que el descuento es real</p>
            <ul className="mt-1.5 space-y-1">
              {NIVELES_EVIDENCIA.map((nivel) => (
                <li key={nivel}>
                  <strong className={`font-medium ${EVIDENCIA[nivel].color}`}>
                    {EVIDENCIA[nivel].texto.charAt(0).toUpperCase() + EVIDENCIA[nivel].texto.slice(1)}.
                  </strong>{" "}
                  {EVIDENCIA[nivel].ayuda}
                </li>
              ))}
            </ul>
            <p className="mt-1.5">
              Si un descuento no cierra por ningun lado, la promo no se muestra: por ejemplo, una notebook de
              $1.439.000 &quot;a $214.900&quot;.
            </p>
          </div>

          {/* Filas separadas por linea fina, como los demas listados del sitio. */}
          <div className="border-t border-linea divide-y divide-linea">
            {lote.map((promo, i) => (
              <PromoCard key={`${promo.descripcion}-${promo.cadena}-${i}`} promo={promo} sucursales={sucursales} />
            ))}
          </div>

          {faltan > 0 && (
            <button
              onClick={() => setMostradas(mostradas + TANDA)}
              className="w-full py-3 text-sm font-medium text-tinta-media hover:bg-papel-hundido border-b border-linea transition-colors"
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
