import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { ContextoLista, type EstadoLista } from "../contexto/lista";
import { agregarALista, CLAVE_LISTA, guardarLista, leerLista, MAXIMO_PRODUCTOS, sumarListas } from "../utils/lista";
import type { ItemLista } from "../types";

/*
  Tu lista para todo el sitio (openspec lista-a-mano). Antes vivia adentro de
  Mismo producto y ninguna otra pagina podia saber que existia. Se guarda en el
  navegador con la misma clave de siempre, asi que las listas ya armadas
  siguen ahi. Un cambio en otra pestaña llega por el evento "storage", que no se
  dispara en la pestaña que escribe: guardar aca no vuelve a leer.
*/
function ProveedorLista({ children }: { children: ReactNode }) {
  const [lista, setLista] = useState<ItemLista[]>(leerLista);

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

  const agregar = useCallback((item: ItemLista) => setLista((previa) => agregarALista(previa, item)), []);
  const cambiarCantidad = useCallback(
    (idProducto: string, cantidad: number) =>
      setLista((previa) => previa.map((i) => (i.id_producto === idProducto ? { ...i, cantidad } : i))),
    []
  );
  const quitar = useCallback(
    (idProducto: string) => setLista((previa) => previa.filter((i) => i.id_producto !== idProducto)),
    []
  );
  const vaciar = useCallback(() => setLista([]), []);
  const sumar = useCallback((items: ItemLista[]) => setLista((previa) => sumarListas(previa, items)), []);
  const reemplazar = useCallback((items: ItemLista[]) => setLista(items.slice(0, MAXIMO_PRODUCTOS)), []);

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
    }),
    [lista, agregar, cambiarCantidad, quitar, vaciar, sumar, reemplazar]
  );

  return <ContextoLista.Provider value={estado}>{children}</ContextoLista.Provider>;
}

export default ProveedorLista;
