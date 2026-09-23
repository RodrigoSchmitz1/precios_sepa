import { MapContainer, Marker, Popup, useMapEvents } from "react-leaflet";
import MarkerClusterGroup from "react-leaflet-cluster";
import { useEffect, useRef } from "react";
import "leaflet/dist/leaflet.css";
import "../utils/leaflet";
import MapaBase from "./MapaBase";
import "react-leaflet-cluster/dist/assets/MarkerCluster.css";
import "react-leaflet-cluster/dist/assets/MarkerCluster.Default.css";
import type { PromoMapa, SucursalMapa } from "../types";
import { nombreLegible } from "../utils/texto";
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

type Props = {
  promos: PromoMapa[];
  sucursales: Record<string, SucursalMapa>;
  onMoverMapa: (bbox: BoundingBox) => void;
};

function MapaPromos({ promos, sucursales, onMoverMapa }: Props) {
  const centroDefault: [number, number] = [-34.6, -58.4];
  const grupos = agruparPorSucursal(promos, sucursales);

  return (
    <MapContainer
      center={centroDefault}
      zoom={11}
      scrollWheelZoom={true}
      style={{ height: "500px", width: "100%", borderRadius: "8px" }}
    >
      <DetectorMovimiento onMoverMapa={onMoverMapa} />
      <MapaBase />
      <MarkerClusterGroup chunkedLoading>
        {grupos.map((grupo, i) => (
          <Marker key={i} position={[grupo.latitud, grupo.longitud]}>
            <Popup>
              <div className="max-w-xs">
                <p className="font-semibold">
                  {grupo.cadena} - {grupo.nombre_sucursal}
                </p>
                <p className="text-xs text-gray-500 mb-2">
                  {grupo.calle} {grupo.numero}, {grupo.localidad}, {nombreProvincia(grupo.provincia)}
                </p>
                <p className="text-xs font-semibold text-gray-700 mb-1">
                  {grupo.promos.length} promo{grupo.promos.length > 1 ? "s" : ""} vigente{grupo.promos.length > 1 ? "s" : ""}:
                </p>
                <div className="max-h-48 overflow-y-auto space-y-2">
                  {grupo.promos.map((promo, j) => (
                    <div key={j} className="border-t border-gray-100 pt-1">
                      <p className="text-sm">{nombreLegible(promo.descripcion, promo.marca)}</p>
                      <p className="text-xs text-gray-600">
                        de ${promo.precio_lista} a ${promo.precio_promo} ({promo.descuento_pct}% off)
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </Popup>
          </Marker>
        ))}
      </MarkerClusterGroup>
    </MapContainer>
  );
}

export default MapaPromos;
