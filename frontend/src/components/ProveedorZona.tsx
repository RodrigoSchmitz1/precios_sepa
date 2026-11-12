import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router";
import { obtenerZonas } from "../api/client";
import { ContextoZona, type EstadoZona } from "../contexto/zona";
import { guardarZona, leerZonaGuardada, searchConZona, zonaInicial, zonaMasCercana, type Zona } from "../utils/zona";

/*
  La zona del usuario para todo el sitio (openspec/changes/zona-compartida).

  Carga la lista de lugares una vez, arranca con la zona del link o con la
  guardada, la recuerda en el navegador y la refleja en la URL de cada pagina
  (?zona=), asi cualquier link copiado la lleva. Reemplazar la URL y no
  agregar una entrada al historial: el boton de volver no tiene que pasar por
  cada pagina dos veces.
*/
function ProveedorZona({ children }: { children: ReactNode }) {
  const ubicacion = useLocation();
  const navegar = useNavigate();
  const [zonas, setZonas] = useState<Zona[]>([]);
  const [zona, setZona] = useState<Zona | null>(null);
  const [lista, setLista] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [ubicando, setUbicando] = useState(false);
  const [errorUbicacion, setErrorUbicacion] = useState<string | null>(null);
  // El search con el que se abrio el sitio: la zona del link se lee de ahi.
  const [searchInicial] = useState(ubicacion.search);

  useEffect(() => {
    let cancelado = false;
    obtenerZonas()
      .then((lugares) => {
        if (cancelado) return;
        const inicial = zonaInicial(lugares, searchInicial, leerZonaGuardada());
        setZonas(lugares);
        setZona(inicial.zona);
        guardarZona(inicial.zona);
        if (inicial.desconocida) setAviso(`No encontramos "${inicial.desconocida}" entre las zonas con sucursales.`);
      })
      // Sin la lista no hay zona: cada pagina muestra todo el pais, como antes.
      .catch(() => {})
      .finally(() => {
        if (!cancelado) setLista(true);
      });
    return () => {
      cancelado = true;
    };
  }, [searchInicial]);

  // La URL de cada pagina lleva la zona; hasta que la lista cargue no se toca,
  // para no borrar la zona de un link antes de haberla leido.
  useEffect(() => {
    if (!lista) return;
    const buscado = searchConZona(ubicacion.search, zona);
    if (buscado !== ubicacion.search) {
      navegar({ pathname: ubicacion.pathname, search: buscado, hash: ubicacion.hash }, { replace: true });
    }
  }, [lista, zona, ubicacion.pathname, ubicacion.search, ubicacion.hash, navegar]);

  const elegir = useCallback((nueva: Zona | null) => {
    setZona(nueva);
    guardarZona(nueva);
    setAviso(null);
    setErrorUbicacion(null);
  }, []);

  const usarUbicacion = useCallback(() => {
    if (!("geolocation" in navigator)) {
      setErrorUbicacion("Este navegador no puede darnos tu ubicación. Buscá tu barrio o localidad.");
      return;
    }
    setUbicando(true);
    setErrorUbicacion(null);
    navigator.geolocation.getCurrentPosition(
      (posicion) => {
        setUbicando(false);
        const cercana = zonaMasCercana(zonas, posicion.coords.latitude, posicion.coords.longitude);
        if (cercana) elegir(cercana);
        else setErrorUbicacion("No encontramos sucursales cerca. Buscá tu barrio o localidad.");
      },
      () => {
        setUbicando(false);
        setErrorUbicacion("No pudimos leer tu ubicación. Buscá tu barrio o localidad.");
      },
      { timeout: 10000, maximumAge: 600000 }
    );
  }, [zonas, elegir]);

  const estado = useMemo<EstadoZona>(
    () => ({
      zona,
      zonas,
      lista,
      aviso,
      elegir,
      usarUbicacion,
      ubicando,
      errorUbicacion,
      cerrarAviso: () => setAviso(null),
    }),
    [zona, zonas, lista, aviso, elegir, usarUbicacion, ubicando, errorUbicacion]
  );

  return <ContextoZona.Provider value={estado}>{children}</ContextoZona.Provider>;
}

export default ProveedorZona;
