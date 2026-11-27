import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { obtenerBasicos } from "../api/client";
import { ContextoLista, type EstadoLista } from "../contexto/lista";
import { elegirEjemplo, guardarMarcaEjemplo, leerMarcaEjemplo, SEGUNDOS_PARA_DESHACER, type MarcaEjemplo } from "../utils/ejemploDeCompra";
import { agregarALista, CLAVE_LISTA, guardarLista, leerLista, MAXIMO_PRODUCTOS, sumarListas } from "../utils/lista";
import type { ItemLista } from "../types";

/*
  Tu lista para todo el sitio (openspec lista-a-mano). Antes vivia adentro de
  Mismo producto y ninguna otra pagina podia saber que existia. Se guarda en el
  navegador con la misma clave de siempre, asi que las listas ya armadas
  siguen ahi. Un cambio en otra pestaña llega por el evento "storage", que no se
  dispara en la pestaña que escribe: guardar aca no vuelve a leer.

  La compra de ejemplo (app-para-el-usuario, antes ejemplo-para-empezar) ya no
  se carga sola: se pide con "Ver un ejemplo" (verEjemplo). Mientras la lista
  es el ejemplo, sumar un producto propio lo REEMPLAZA -antes se mezclaba con 12
  productos que nadie eligio- y durante unos segundos se puede deshacer.
  Cambiar una cantidad o quitar uno suelto la vuelve propia con lo que tenia;
  sacar un grupo con su chip no.
*/
function ProveedorLista({ children }: { children: ReactNode }) {
  const [lista, setLista] = useState<ItemLista[]>(leerLista);
  const [marca, setMarca] = useState<MarcaEjemplo>(leerMarcaEjemplo);
  const [paraDeshacer, setParaDeshacer] = useState<ItemLista[] | null>(null);
  const listaActual = useRef(lista);
  useEffect(() => {
    listaActual.current = lista;
  }, [lista]);
  const marcaActual = useRef(marca);
  useEffect(() => {
    marcaActual.current = marca;
    if (marca) guardarMarcaEjemplo(marca);
  }, [marca]);

  // "Deshacer" se ofrece un rato y despues se va solo.
  useEffect(() => {
    if (!paraDeshacer) return;
    const espera = setTimeout(() => setParaDeshacer(null), SEGUNDOS_PARA_DESHACER * 1000);
    return () => clearTimeout(espera);
  }, [paraDeshacer]);

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

  /** La lista deja de ser ejemplo (si lo era) y queda como propia. */
  const terminarEjemplo = useCallback(() => setMarca((previa) => (previa === "activo" ? "hecho" : previa)), []);

  /**
   * Suma productos propios. Con el ejemplo puesto, lo reemplazan y se guarda el
   * ejemplo para "Deshacer".
   */
  const sumarPropios = useCallback((sumarA: (previa: ItemLista[]) => ItemLista[]) => {
    if (marcaActual.current === "activo") {
      setParaDeshacer(listaActual.current);
      setMarca("hecho");
      setLista(sumarA([]));
      return;
    }
    setLista(sumarA);
  }, []);

  const agregar = useCallback(
    (item: ItemLista) => sumarPropios((previa) => agregarALista(previa, item)),
    [sumarPropios]
  );
  const sumar = useCallback(
    (items: ItemLista[]) => sumarPropios((previa) => sumarListas(previa, items)),
    [sumarPropios]
  );
  const deshacer = useCallback(() => {
    if (!paraDeshacer) return;
    // Vuelve el ejemplo con lo que se sumo, como lista propia.
    setLista((actual) => sumarListas(paraDeshacer, actual).slice(0, MAXIMO_PRODUCTOS));
    setParaDeshacer(null);
  }, [paraDeshacer]);
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
    setParaDeshacer(null);
    setLista([]);
  }, [terminarEjemplo]);
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
  /** Carga la compra de ejemplo. Falso si no se pudo armar (la lista queda como estaba). */
  const verEjemplo = useCallback(async (): Promise<boolean> => {
    try {
      const items = elegirEjemplo(await obtenerBasicos());
      if (items.length === 0) return false;
      setParaDeshacer(null);
      setMarca("activo");
      setLista(items);
      return true;
    } catch {
      return false;
    }
  }, []);
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
      verEjemplo,
      deshacer: paraDeshacer ? deshacer : null,
    }),
    [lista, agregar, cambiarCantidad, quitar, vaciar, sumar, reemplazar, esEjemplo, quitarGrupo, verEjemplo, paraDeshacer, deshacer]
  );

  return <ContextoLista.Provider value={estado}>{children}</ContextoLista.Provider>;
}

export default ProveedorLista;
