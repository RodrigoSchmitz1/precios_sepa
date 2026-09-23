import { useState, useEffect, useMemo } from "react";
import MapaPromos from "../components/MapaPromos";
import type { BoundingBox } from "../components/MapaPromos";
import PromoCard from "../components/PromoCard";
import Presentacion from "../components/Presentacion";
import Filtros from "../components/Filtros";
import FilaDeCifras from "../components/FilaDeCifras";
import FiltroCategorias, { type Seleccion } from "../components/FiltroCategorias";
import { obtenerPromosMapa } from "../api/client";
import type { PromoMapa, SucursalMapa } from "../types";
import { formatearNumero } from "../utils/formato";

const TANDA = 60;

function PromosPage() {
  const [promos, setPromos] = useState<PromoMapa[]>([]);
  const [hayMas, setHayMas] = useState(false);
  const [sucursales, setSucursales] = useState<Record<string, SucursalMapa>>({});
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [busqueda, setBusqueda] = useState("");
  const [provincia, setProvincia] = useState("");
  const [filtro, setFiltro] = useState<Seleccion>(null);
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
    if (!filtro) return promos;
    return filtro.tipo === "rubro"
      ? promos.filter((p) => (p.rubro ?? "Otros") === filtro.valor)
      : promos.filter((p) => p.categoria === filtro.valor);
  }, [promos, filtro]);

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
  const [entradaPrevia, setEntradaPrevia] = useState({ filtro, promos });
  if (entradaPrevia.filtro !== filtro || entradaPrevia.promos !== promos) {
    setEntradaPrevia({ filtro, promos });
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
          busqueda={busqueda}
          onBusquedaChange={setBusqueda}
          provincia={provincia}
          onProvinciaChange={setProvincia}
        />
      </div>

      <div className="mb-8">
        <div className="rounded-xl overflow-hidden border border-linea">
          <MapaPromos promos={promos} sucursales={sucursales} onMoverMapa={setBbox} />
        </div>
        <p className="text-xs text-tinta-suave mt-2">
          Movete o haces zoom en el mapa para ver las promos de otra zona.
        </p>
      </div>

      {/*
        minmax(0,1fr) y no 1fr: el minimo implicito de una columna de grilla es
        auto, asi que la lista no podia achicarse por debajo del ancho de su
        contenido y empujaba la pagina hasta meter scroll horizontal. Con 5xl no
        se notaba porque sobraba margen; al ensanchar a 6xl quedo a la vista.
      */}
      <div className="grid lg:grid-cols-[13rem_minmax(0,1fr)] gap-x-8 gap-y-6">
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <FiltroCategorias promos={promos} elegido={filtro} onElegir={setFiltro} />
        </aside>

        <div>
          <div className="flex items-baseline justify-between gap-3 mb-3">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-tinta-suave">
              {filtro?.valor ?? "Todas las promos"}
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
                : `No hay promos de ${filtro?.valor} en esta zona.`}
            </p>
          )}

          {/*
            Una linea explica de donde sale el respaldo de cada promo. La
            etiqueta sola no alcanzaba: decir "verificado" invita a preguntar
            verificado por quien, y esa respuesta es justamente lo que separa a
            este listado de copiar los carteles de la gondola.
          */}
          <p className="text-xs text-tinta-media bg-papel-hundido rounded-lg px-3 py-2 mb-4 leading-relaxed">
            Cada promo dice con que se sostiene su descuento:{" "}
            <strong className="text-ahorro font-medium">lo declara la cadena</strong> (informa el porcentaje y
            coincide con sus precios),{" "}
            <strong className="text-dato-azul font-medium">verificado con otras cadenas</strong> (el precio de
            promo se sostiene frente al mismo producto en otras empresas) o{" "}
            <strong className="text-aviso font-medium">nadie lo confirma</strong> (solo se sabe que el descuento
            no es inverosimil). Las que no pasan ninguno de los tres no se muestran.
          </p>

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
