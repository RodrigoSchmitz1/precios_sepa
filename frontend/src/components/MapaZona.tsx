import { useEffect } from "react";
import { Circle, CircleMarker, MapContainer, Marker, Popup, useMap, useMapEvents } from "react-leaflet";
import MapaBase from "./MapaBase";
import ZoomConRuedaAlTocar from "./ZoomConRuedaAlTocar";
import "leaflet/dist/leaflet.css";
import "../utils/leaflet";
import type { SucursalOpcion } from "../types";

/*
  Mapa para elegir la zona donde se va a hacer la compra: un punto y un radio.

  El punto se elige tocando el mapa, arrastrando el marcador o con el boton de
  ubicacion. Se eligio punto + radio y no "elegi tu localidad" porque la compra
  se hace caminando o en auto desde algun lado concreto: los limites
  administrativos no dicen nada sobre que tenes a diez cuadras, y en el AMBA el
  borde entre localidades parte barrios al medio.

  Las sucursales elegidas se dibujan encima, para que se vea donde quedan
  respecto del punto.
*/

type Props = {
  punto: { latitud: number; longitud: number } | null;
  radioKm: number;
  onElegirPunto: (latitud: number, longitud: number) => void;
  sucursales?: SucursalOpcion[];
};

function DetectorDeClick({ onElegirPunto }: { onElegirPunto: Props["onElegirPunto"] }) {
  useMapEvents({
    click: (evento) => onElegirPunto(evento.latlng.lat, evento.latlng.lng),
  });
  return null;
}

/** Centra el mapa cuando el punto cambia desde afuera (geolocalizacion) y
 *  ajusta el zoom al radio, para que el circulo entre siempre en pantalla. */
function Encuadrar({ punto, radioKm }: { punto: Props["punto"]; radioKm: number }) {
  const mapa = useMap();
  useEffect(() => {
    if (!punto) return;
    const zoom = radioKm <= 1 ? 14 : radioKm <= 2 ? 13 : 12;
    mapa.setView([punto.latitud, punto.longitud], zoom);
  }, [mapa, punto, radioKm]);
  return null;
}

function MapaZona({ punto, radioKm, onElegirPunto, sucursales = [] }: Props) {
  // Centro por defecto: el Obelisco. Solo se usa hasta que el usuario elige.
  const centro: [number, number] = punto ? [punto.latitud, punto.longitud] : [-34.6037, -58.3816];

  return (
    <MapContainer center={centro} zoom={12} scrollWheelZoom={false} style={{ height: "360px", width: "100%" }}>
      <ZoomConRuedaAlTocar />
      <MapaBase />
      <DetectorDeClick onElegirPunto={onElegirPunto} />
      <Encuadrar punto={punto} radioKm={radioKm} />

      {punto && (
        <>
          <Circle
            center={[punto.latitud, punto.longitud]}
            radius={radioKm * 1000}
            pathOptions={{ color: "#0b6b4d", weight: 1, fillColor: "#0b6b4d", fillOpacity: 0.07 }}
          />
          <Marker
            position={[punto.latitud, punto.longitud]}
            draggable
            eventHandlers={{
              dragend: (evento) => {
                const { lat, lng } = evento.target.getLatLng();
                onElegirPunto(lat, lng);
              },
            }}
          >
            <Popup>Arrastrame o toca el mapa para mover la zona</Popup>
          </Marker>
        </>
      )}

      {/* Las sucursales elegidas van como circulos y no como chinches: el
          marcador ya lo usa el punto del usuario, y mezclarlos haria pensar que
          son la misma cosa. */}
      {sucursales.map((s) => (
        <CircleMarker
          key={s.id}
          center={[s.latitud, s.longitud]}
          radius={7}
          pathOptions={{ color: "#0b6b4d", weight: 2, fillColor: "#ffffff", fillOpacity: 1 }}
        >
          <Popup>
            <span className="font-semibold">{s.cadena}</span>
            <br />
            {s.direccion ?? s.nombre_sucursal}
            <br />
            <span className="numero">{s.distancia_km} km</span>
          </Popup>
        </CircleMarker>
      ))}
    </MapContainer>
  );
}

export default MapaZona;
