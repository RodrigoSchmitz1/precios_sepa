import { useEffect } from "react";
import { useMap } from "react-leaflet";

/*
  El zoom con la ruedita arranca apagado y se prende al hacer click en el mapa.

  Con el zoom siempre activo, quien bajaba por la pagina con la ruedita y pasaba
  el cursor por encima del mapa lo alejaba hasta ver el mundo entero, en vez de
  seguir bajando. Es lo que hacen los mapas embebidos de Google: la pagina se
  mueve con la ruedita, el mapa solo cuando uno lo eligio. Al salir el mouse se
  vuelve a apagar, para no atrapar el scroll la proxima vez.
*/
function ZoomConRuedaAlTocar() {
  const mapa = useMap();
  useEffect(() => {
    const prender = () => mapa.scrollWheelZoom.enable();
    const apagar = () => mapa.scrollWheelZoom.disable();
    apagar();
    mapa.on("click", prender);
    mapa.on("focus", prender);
    mapa.on("mouseout", apagar);
    return () => {
      mapa.off("click", prender);
      mapa.off("focus", prender);
      mapa.off("mouseout", apagar);
    };
  }, [mapa]);
  return null;
}

export default ZoomConRuedaAlTocar;
