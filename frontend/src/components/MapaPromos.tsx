import { MapContainer, TileLayer, Marker, Popup, useMapEvents } from "react-leaflet";
import MarkerClusterGroup from "react-leaflet-cluster";
import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "react-leaflet-cluster/dist/assets/MarkerCluster.css";
import "react-leaflet-cluster/dist/assets/MarkerCluster.Default.css";
import type { PromoMapa } from "../types";
import { nombreProvincia } from "../utils/provincias";

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

export type BoundingBox = {
  latMin: number;
  latMax: number;
  lngMin: number;
  lngMax: number;
};

type GrupoSucursal = {
  latitud: number;
  longitud: number;
  cadena: string;
  nombre_sucursal: string;
  calle: string;
  numero: string;
  localidad: string;
  provincia: string;
  promos: PromoMapa[];
};

function agruparPorSucursal(promos: PromoMapa[]): GrupoSucursal[] {
  const grupos = new Map<string, GrupoSucursal>();

  for (const promo of promos) {
    const clave = `${promo.latitud}-${promo.longitud}`;
    const existente = grupos.get(clave);

    if (existente) {
      existente.promos.push(promo);
    } else {
      grupos.set(clave, {
        latitud: promo.latitud,
        longitud: promo.longitud,
        cadena: promo.cadena,
        nombre_sucursal: promo.nombre_sucursal,
        calle: promo.calle,
        numero: promo.numero,
        localidad: promo.localidad,
        provincia: promo.provincia,
        promos: [promo],
      });
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
  onMoverMapa: (bbox: BoundingBox) => void;
};

function MapaPromos({ promos, onMoverMapa }: Props) {
  const centroDefault: [number, number] = [-34.6, -58.4];
  const grupos = agruparPorSucursal(promos);

  return (
    <MapContainer
      center={centroDefault}
      zoom={11}
      scrollWheelZoom={true}
      style={{ height: "500px", width: "100%", borderRadius: "8px" }}
    >
      <DetectorMovimiento onMoverMapa={onMoverMapa} />
      <TileLayer
        attribution="&copy; OpenStreetMap contributors"
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
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
                      <p className="text-sm">{promo.descripcion}</p>
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
