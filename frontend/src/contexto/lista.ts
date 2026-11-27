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
  /** La lista es la compra de ejemplo, pedida con "Ver un ejemplo" (app-para-el-usuario). */
  esEjemplo: boolean;
  /** Vacia la lista; el ejemplo no vuelve. */
  borrarEjemplo: () => void;
  /** Saca un grupo entero de basicos sin que la lista deje de ser ejemplo. */
  quitarGrupo: (grupo: string) => void;
  /** Carga la compra de ejemplo a pedido ("Ver un ejemplo"). Falso si no se pudo armar. */
  verEjemplo: () => Promise<boolean>;
  /** Mientras se puede: vuelve el ejemplo que un producto propio acaba de reemplazar. */
  deshacer: (() => void) | null;
};

export const ContextoLista = createContext<EstadoLista | null>(null);

export function useLista(): EstadoLista {
  const estado = useContext(ContextoLista);
  if (!estado) throw new Error("useLista tiene que usarse adentro de ProveedorLista");
  return estado;
}
