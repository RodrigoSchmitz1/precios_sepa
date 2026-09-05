import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { PromoMapa } from "../types";
import { nombreProvincia } from "../utils/provincias";

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

type Props = {
  promos: PromoMapa[];
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

function MapaPromos({ promos }: Props) {
  const centroDefault: [number, number] = [-34.6, -58.4];
  const grupos = agruparPorSucursal(promos);

  return (
    <MapContainer
      center={centroDefault}
      zoom={11}
      scrollWheelZoom={true}
      style={{ height: "500px", width: "100%", borderRadius: "8px" }}
    >
      <TileLayer
        attribution="&copy; OpenStreetMap contributors"
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
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
    </MapContainer>
  );
}

export default MapaPromos;
