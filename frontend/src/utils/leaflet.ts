import L from "leaflet";

/*
  Workaround conocido de Leaflet con bundlers: el prototipo del icono por
  defecto arma la URL con un helper interno que no existe una vez empaquetado,
  asi que hay que sacarlo para que tomen las URLs de mergeOptions.

  Vive aca y no adentro de un componente porque ahora hay dos mapas (las promos
  y la zona de Tu canasta) y el arreglo tiene que estar aplicado en los dos, sin
  depender de cual se monto primero.
*/
delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});
