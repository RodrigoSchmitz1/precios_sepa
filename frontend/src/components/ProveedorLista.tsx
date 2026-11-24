import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { obtenerBasicos } from "../api/client";
import { ContextoLista, type EstadoLista } from "../contexto/lista";
import { elegirEjemplo, guardarMarcaEjemplo, leerMarcaEjemplo, type MarcaEjemplo } from "../utils/ejemploDeCompra";
import { agregarALista, CLAVE_LISTA, guardarLista, leerLista, MAXIMO_PRODUCTOS, sumarListas } from "../utils/lista";
import type { ItemLista } from "../types";

/*
  Tu lista para todo el sitio (openspec lista-a-mano). Antes vivia adentro de
  Mismo producto y ninguna otra pagina podia saber que existia. Se guarda en el
  navegador con la misma clave de siempre, asi que las listas ya armadas
  siguen ahi. Un cambio en otra pestaña llega por el evento "storage", que no se
  dispara en la pestaña que escribe: guardar aca no vuelve a leer.

  Con conEjemplo (lo pasa el Layout), la primera vez que se abre la app con la
  lista vacia se carga la compra de ejemplo (openspec ejemplo-para-empezar).
  Tocar la lista la hace propia; sacar un grupo con su chip no.
*/
function ProveedorLista({ children, conEjemplo = false }: { children: ReactNode; conEjemplo?: boolean }) {
  const [lista, setLista] = useState<ItemLista[]>(leerLista);
  // Con lista propia, o con una lista que llega por link, el ejemplo ya no
  // corresponde nunca: la marca nace "hecho".
  const [marca, setMarca] = useState<MarcaEjemplo>(() => {
    const guardada = leerMarcaEjemplo();
    if (!conEjemplo || guardada !== null) return guardada;
    return leerLista().length > 0 || new URLSearchParams(window.location.search).has("l") ? "hecho" : null;
  });
  const listaActual = useRef(lista);
  useEffect(() => {
    listaActual.current = lista;
  }, [lista]);
  const marcaActual = useRef(marca);
  useEffect(() => {
    marcaActual.current = marca;
    if (marca) guardarMarcaEjemplo(marca);
  }, [marca]);

  const terminarEjemplo = useCallback(() => setMarca((previa) => (previa === null && !conEjemplo ? null : "hecho")), [conEjemplo]);

  // Una sola vez al abrir, si la marca nacio vacia: se piden los basicos.
  const [cargarEjemplo] = useState(marca === null && conEjemplo);
  useEffect(() => {
    if (!cargarEjemplo) return;
    let cancelado = false;
    // El then de afuera hace que un fallo al llamar (no solo al responder) caiga en el catch.
    Promise.resolve()
      .then(() => obtenerBasicos())
      .then((basicos) => {
        if (cancelado) return;
        const items = elegirEjemplo(basicos);
        if (items.length === 0) return;
        // Si mientras tanto se toco la lista, ya es propia (terminarEjemplo la marco).
        if (listaActual.current.length > 0 || marcaActual.current === "hecho") return;
        setMarca("activo");
        setLista(items);
      })
      .catch(() => {
        /* sin basicos no hay ejemplo; se reintenta en la proxima visita */
      });
    return () => {
      cancelado = true;
    };
  }, [cargarEjemplo]);

  useEffect(() => {
    guardarLista(lista);
  }, [lista]);

  useEffect(() => {
    const alCambiar = (e: StorageEvent) => {
      if (e.key === CLAVE_LISTA) setLista(leerLista());
    };
    window.addEventListener("storage", alCambiar);
    return () => window.removeEventListener("storage", alCambiar);
  }, []);

  const agregar = useCallback(
    (item: ItemLista) => {
      terminarEjemplo();
      setLista((previa) => agregarALista(previa, item));
    },
    [terminarEjemplo]
  );
  const cambiarCantidad = useCallback(
    (idProducto: string, cantidad: number) => {
      terminarEjemplo();
      setLista((previa) => previa.map((i) => (i.id_producto === idProducto ? { ...i, cantidad } : i)));
    },
    [terminarEjemplo]
  );
  const quitar = useCallback(
    (idProducto: string) => {
      terminarEjemplo();
      setLista((previa) => previa.filter((i) => i.id_producto !== idProducto));
    },
    [terminarEjemplo]
  );
  const vaciar = useCallback(() => {
    terminarEjemplo();
    setLista([]);
  }, [terminarEjemplo]);
  const sumar = useCallback(
    (items: ItemLista[]) => {
      terminarEjemplo();
      setLista((previa) => sumarListas(previa, items));
    },
    [terminarEjemplo]
  );
  const reemplazar = useCallback(
    (items: ItemLista[]) => {
      terminarEjemplo();
      setLista(items.slice(0, MAXIMO_PRODUCTOS));
    },
    [terminarEjemplo]
  );
  const quitarGrupo = useCallback(
    (grupo: string) => setLista((previa) => previa.filter((i) => i.grupo !== grupo)),
    []
  );
  const esEjemplo = marca === "activo" && lista.length > 0;

  const estado = useMemo<EstadoLista>(
    () => ({
      lista,
      agregar,
      cambiarCantidad,
      quitar,
      vaciar,
      sumar,
      reemplazar,
      enLista: (idProducto) => lista.some((i) => i.id_producto === idProducto),
      esEjemplo,
      borrarEjemplo: vaciar,
      quitarGrupo,
    }),
    [lista, agregar, cambiarCantidad, quitar, vaciar, sumar, reemplazar, esEjemplo, quitarGrupo]
  );

  return <ContextoLista.Provider value={estado}>{children}</ContextoLista.Provider>;
}

export default ProveedorLista;
