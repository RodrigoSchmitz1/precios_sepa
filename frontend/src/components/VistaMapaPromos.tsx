import { useState, useEffect } from "react";
import MapaPromos from "./MapaPromos";
import type { BoundingBox, Destino } from "./MapaPromos";
import { useZona } from "../contexto/zona";
import type { Zona } from "../utils/zona";
import Filtros from "./Filtros";
import BuscadorProducto from "./BuscadorProducto";
import FilaDeCifras from "./FilaDeCifras";
import FiltroCategorias, { type Seleccion } from "./FiltroCategorias";
import ListadoPromos from "./ListadoPromos";
import { obtenerLugares, obtenerPromosMapa } from "../api/client";
import type { LugarMapa, PromoMapa, SucursalMapa } from "../types";
import { formatearNumero } from "../utils/formato";

/*
  Cuantas promos pide cada movida del mapa. Con 2000 (hasta el 2026-09-23) el
  corte dejaba solo los descuentos mas grandes, y esos son casi todos de
  Carrefour. Se probo con 6000, el tope de la API, y el mapa se sentia lento al
  moverlo; 5000 cubre casi todo Palermo con 400 KB comprimidos.
*/
const PROMOS_POR_ZONA = 5000;

/*
  El mapa de promos y el listado de lo que muestra. Hasta
  promos-navegables-y-mes-en-gastos era la portada entera; ahora se abre con
  "Ver en el mapa" (?mapa=1) y se carga aparte (React.lazy), asi Leaflet y las
  5000 promos no viajan hasta que alguien lo pide.
*/
function VistaMapaPromos({ busquedaInicial = "" }: { busquedaInicial?: string }) {
  const [promos, setPromos] = useState<PromoMapa[]>([]);
  const [hayMas, setHayMas] = useState(false);
  const [sucursales, setSucursales] = useState<Record<string, SucursalMapa>>({});
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [busqueda, setBusqueda] = useState(busquedaInicial);
  const [provincia, setProvincia] = useState("");
  const [filtro, setFiltro] = useState<Seleccion>(null);
  const [bbox, setBbox] = useState<BoundingBox | null>(null);
  const [lugares, setLugares] = useState<LugarMapa[]>([]);
  const [destino, setDestino] = useState<Destino | null>(null);

  /*
    Con zona, el mapa arranca en ella (zona compartida, 2026-11), y vuelve a
    ella si el usuario la cambia desde el encabezado. Mover el mapa o buscar
    otro lugar aca cambia lo que se ve, no la zona.
  */
  const { zona } = useZona();
  const [zonaVista, setZonaVista] = useState<Zona | null>(null);
  if (zona && zona !== zonaVista) {
    setZonaVista(zona);
    setDestino({ latitud: zona.latitud, longitud: zona.longitud, zoom: 14 });
  }

  // Si falla, el buscador de lugares queda sin sugerencias y el resto sigue andando.
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
    Elegir provincia tambien lleva el mapa ahi, a su localidad con mas
    sucursales: solo filtrar lo que ya estaba a la vista dejaba el mapa vacio.
  */
  function elegirProvincia(codigo: string) {
    setProvincia(codigo);
    const principal = lugares.find((l) => l.provincia === codigo);
    if (principal) setDestino({ latitud: principal.latitud, longitud: principal.longitud, zoom: 11 });
  }

  useEffect(() => {
    if (!bbox) return;
    // "cancelado" evita que una respuesta lenta pise a una posterior.
    let cancelado = false;
    const timeoutId = setTimeout(() => {
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

  // Resumen de la zona visible. La respuesta viene por descuento descendente.
  const mayorDescuento = promos.length > 0 ? Math.round(promos[0].descuento_pct) : 0;
  const cadenaDelMayor = promos.length > 0 ? promos[0].cadena : "";
  const cadenas = new Set(promos.map((p) => p.cadena)).size;
  const categoriasDistintas = new Set(promos.map((p) => p.categoria).filter(Boolean)).size;

  return (
    <div>
      {promos.length > 0 && (
        <div className="mb-6">
          <FilaDeCifras
            cifras={[
              { etiqueta: "En esta zona", valor: formatearNumero(promos.length), detalle: "promos vigentes" },
              { etiqueta: "Mayor descuento", valor: `${mayorDescuento}%`, detalle: cadenaDelMayor },
              { etiqueta: "Cadenas", valor: formatearNumero(cadenas), detalle: "con promos acá" },
              { etiqueta: "Categorías", valor: formatearNumero(categoriasDistintas), detalle: "con al menos una promo" },
            ]}
          />
        </div>
      )}

      <div className="mb-5">
        <Filtros lugares={lugares} onElegirLugar={irALugar} provincia={provincia} onProvinciaChange={elegirProvincia} />
      </div>

      <div className="mb-8">
        <div className="rounded-xl overflow-hidden border border-linea">
          <MapaPromos promos={promos} sucursales={sucursales} onMoverMapa={setBbox} destino={destino} />
        </div>
        <p className="text-xs text-tinta-suave mt-2">
          Movete por el mapa para ver las promos de otra zona. Para hacer zoom con la ruedita, primero hacé click en el mapa.
        </p>
      </div>

      <div className="mb-6">
        <BuscadorProducto busqueda={busqueda} onBusquedaChange={setBusqueda} />
      </div>

      {/*
        minmax(0,1fr) y no 1fr: el minimo implicito de una columna de grilla es
        auto, y la lista empujaba la pagina hasta meter scroll horizontal (en el
        celular, 829px en una pantalla de 375).
      */}
      <div className="grid grid-cols-[minmax(0,1fr)] lg:grid-cols-[13rem_minmax(0,1fr)] gap-x-8 gap-y-6">
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <FiltroCategorias promos={promos} elegido={filtro} onElegir={setFiltro} />
        </aside>
        <ListadoPromos
          promos={promos}
          sucursales={sucursales}
          cargando={cargando}
          error={error}
          hayMas={hayMas}
          filtro={filtro}
          busqueda={busqueda}
          lugar="en esta zona"
        />
      </div>
    </div>
  );
}

export default VistaMapaPromos;
