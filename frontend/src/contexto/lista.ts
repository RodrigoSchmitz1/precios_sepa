import { createContext, useContext } from "react";
import type { ItemLista } from "../types";

/*
  Tu lista, compartida por todo el sitio (openspec lista-a-mano). La arma
  ProveedorLista adentro del Layout: el encabezado muestra cuantos productos
  tiene, /lista la muestra entera y Mismo producto la arma.
*/
export type EstadoLista = {
  lista: ItemLista[];
  agregar: (item: ItemLista) => void;
  cambiarCantidad: (idProducto: string, cantidad: number) => void;
  quitar: (idProducto: string) => void;
  vaciar: () => void;
  /** Suma una lista recibida: en un producto repetido queda la cantidad mayor. */
  sumar: (items: ItemLista[]) => void;
  /** La lista recibida pasa a ser la lista. */
  reemplazar: (items: ItemLista[]) => void;
  enLista: (idProducto: string) => boolean;
};

export const ContextoLista = createContext<EstadoLista | null>(null);

export function useLista(): EstadoLista {
  const estado = useContext(ContextoLista);
  if (!estado) throw new Error("useLista tiene que usarse adentro de ProveedorLista");
  return estado;
}
