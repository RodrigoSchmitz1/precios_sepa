import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

type PromoMapa = {
  descripcion: string;
  marca: string;
  cadena: string;
  nombre_sucursal: string;
  calle: string;
  numero: string;
  localidad: string;
  provincia: string;
  latitud: number;
  longitud: number;
  precio_lista: number;
  precio_promo: number;
  descuento_pct: number;
  leyenda: string;
};

type Props = {
  promos: PromoMapa[];
};

function MapaPromos({ promos }: Props) {
  const centroDefault: [number, number] = [-34.6, -58.4];

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
      {promos.map((promo, i) => (
        <Marker key={i} position={[promo.latitud, promo.longitud]}>
          <Popup>
            <div>
              <p className="font-semibold">{promo.descripcion}</p>
              <p className="text-sm">{promo.marca}</p>
              <p className="text-sm">
                {promo.cadena} - {promo.nombre_sucursal}
              </p>
              <p className="text-xs">
                {promo.calle} {promo.numero}, {promo.localidad}
              </p>
              <p className="text-sm mt-1">
                ${promo.precio_lista} a ${promo.precio_promo} ({promo.descuento_pct}% off)
              </p>
              <p className="text-xs text-gray-500">{promo.leyenda}</p>
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}

export default MapaPromos;
