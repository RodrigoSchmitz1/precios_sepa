import { TileLayer } from "react-leaflet";

/*
  El fondo de los dos mapas del sitio (promos y zona de Tu canasta).

  Son los tiles de OpenStreetMap pasados a gris con un filtro (ver
  .mapa-base-gris en index.css). A todo color competian con los marcadores, que
  son el dato; en gris los marcadores se leen solos y el mapa conversa con el
  resto del sistema.

  Se probo CARTO Positron, que es gris de origen, pero desde 2025 exige API key y
  sin ella sirve los tiles con una marca de agua de "KEY REQUIRED". OpenStreetMap
  no pide cuenta ni key, y su politica permite el uso liviano de un sitio como
  este con atribucion; lo que prohibe es el uso intensivo. Si el trafico crece,
  el paso siguiente es un proveedor con cuenta (Stadia, MapTiler) y va aca, en
  un solo lugar para que los dos mapas no puedan quedar con fondos distintos.
*/
function MapaBase() {
  return (
    <TileLayer
      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      className="mapa-base-gris"
      maxZoom={19}
    />
  );
}

export default MapaBase;
