import { MapContainer, Marker, Popup, useMap, useMapEvents } from "react-leaflet";
import MarkerClusterGroup from "react-leaflet-cluster";
import { useEffect, useRef } from "react";
import "leaflet/dist/leaflet.css";
import "../utils/leaflet";
import MapaBase from "./MapaBase";
import "react-leaflet-cluster/dist/assets/MarkerCluster.css";
import "react-leaflet-cluster/dist/assets/MarkerCluster.Default.css";
import type { PromoMapa, SucursalMapa } from "../types";
import { nombreLegible } from "../utils/texto";
import { formatearPesos } from "../utils/formato";
import { EVIDENCIA } from "../utils/evidencia";
import { nombreProvincia } from "../utils/provincias";

export type BoundingBox = {
  latMin: number;
  latMax: number;
  lngMin: number;
  lngMax: number;
};

type GrupoSucursal = SucursalMapa & { promos: PromoMapa[] };

/*
  Un marcador por sucursal, con las promos que rigen en ella.

  Cada promo trae los NUMEROS de todas sus sucursales, y los datos de cada
  sucursal vienen una sola vez en la tabla de la respuesta. Antes cada fila de
  la API era una promo en una sucursal y alcanzaba con agrupar por coordenadas;
  cuando la API paso a una fila por promo, este agrupado ubicaba cada promo solo
  en su primera sucursal, y en CABA el mapa bajo de 517 marcadores a 250.
*/
function agruparPorSucursal(promos: PromoMapa[], sucursales: Record<string, SucursalMapa>): GrupoSucursal[] {
  const grupos = new Map<number, GrupoSucursal>();
  for (const promo of promos) {
    for (const id of promo.sucursales) {
      const existente = grupos.get(id);
      if (existente) {
        existente.promos.push(promo);
        continue;
      }
      const sucursal = sucursales[String(id)];
      if (sucursal) grupos.set(id, { ...sucursal, promos: [promo] });
    }
  }
  return Array.from(grupos.values());
}

type DetectorMovimientoProps = {
  onMoverMapa: (bbox: BoundingBox) => void;
};

function DetectorMovimiento({ onMoverMapa }: DetectorMovimientoProps) {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const mapa = useMapEvents({
    moveend: () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => {
        const limites = mapa.getBounds();
        onMoverMapa({
          latMin: limites.getSouth(),
          latMax: limites.getNorth(),
          lngMin: limites.getWest(),
          lngMax: limites.getEast(),
        });
      }, 400);
    },
  });

  useEffect(() => {
    const limites = mapa.getBounds();
    onMoverMapa({
      latMin: limites.getSouth(),
      latMax: limites.getNorth(),
      lngMin: limites.getWest(),
      lngMax: limites.getEast(),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}

export type Destino = { latitud: number; longitud: number; zoom: number };

/*
  Lleva el mapa al lugar elegido en el buscador. Al terminar el vuelo Leaflet
  dispara moveend, y DetectorMovimiento pide las promos de la zona nueva: no hace
  falta avisar nada mas.

  Cada eleccion es un objeto nuevo, asi que elegir dos veces el mismo lugar
  despues de haberse movido vuelve a volar.
*/
function Volar({ destino }: { destino: Destino | null }) {
  const mapa = useMap();
  useEffect(() => {
    if (destino) mapa.flyTo([destino.latitud, destino.longitud], destino.zoom, { duration: 0.8 });
  }, [mapa, destino]);
  return null;
}

type Props = {
  promos: PromoMapa[];
  sucursales: Record<string, SucursalMapa>;
  onMoverMapa: (bbox: BoundingBox) => void;
  destino: Destino | null;
};

function MapaPromos({ promos, sucursales, onMoverMapa, destino }: Props) {
  const centroDefault: [number, number] = [-34.6, -58.4];
  const grupos = agruparPorSucursal(promos, sucursales);

  return (
    <MapContainer
      center={centroDefault}
      zoom={11}
      scrollWheelZoom={true}
      style={{ height: "500px", width: "100%", borderRadius: "16px" }}
    >
      <DetectorMovimiento onMoverMapa={onMoverMapa} />
      <Volar destino={destino} />
      <MapaBase />
      <MarkerClusterGroup chunkedLoading>
        {grupos.map((grupo, i) => (
          <Marker key={i} position={[grupo.latitud, grupo.longitud]}>
            {/*
              Mismo lenguaje que las filas del listado: el precio de promo en
              serif a la derecha, la lista tachada y el descuento en verde, y el
              respaldo de cada promo. Antes decia "de $5190 a $309 (70% off)":
              sin separador de miles, a diferencia del resto del sitio, y en
              ingles.
            */}
            <Popup maxWidth={320} minWidth={260}>
              <div>
                <p className="font-display text-lg leading-tight text-tinta">{grupo.cadena}</p>
                <p className="text-xs text-tinta-suave mt-0.5">
                  {[grupo.calle, grupo.numero].filter(Boolean).join(" ") || grupo.nombre_sucursal}
                  {grupo.localidad && ` · ${grupo.localidad}`}, {nombreProvincia(grupo.provincia)}
                </p>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-tinta-suave mt-3 mb-1">
                  {grupo.promos.length} {grupo.promos.length === 1 ? "promo vigente" : "promos vigentes"}
                </p>
                <ul className="max-h-56 overflow-y-auto divide-y divide-linea -mx-1 px-1">
                  {grupo.promos.map((promo, j) => (
                    <li key={j} className="py-2 flex items-baseline gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-tinta leading-snug">{nombreLegible(promo.descripcion, promo.marca)}</p>
                        {promo.nivel_evidencia && (
                          <p className={`text-[11px] mt-0.5 ${EVIDENCIA[promo.nivel_evidencia].color}`}>
                            {EVIDENCIA[promo.nivel_evidencia].texto}
                          </p>
                        )}
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-display text-base text-tinta leading-none">{formatearPesos(promo.precio_promo)}</p>
                        <p className="numero text-[11px] text-tinta-suave mt-1">
                          <span className="line-through">{formatearPesos(promo.precio_lista)}</span>{" "}
                          <span className="text-ahorro font-medium">−{promo.descuento_pct}%</span>
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </Popup>
          </Marker>
        ))}
      </MarkerClusterGroup>
    </MapContainer>
  );
}

export default MapaPromos;
