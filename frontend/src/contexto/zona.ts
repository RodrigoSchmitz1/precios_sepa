import { createContext, useContext } from "react";
import type { Zona } from "../utils/zona";

/*
  El estado de la zona que comparten todas las paginas. Lo arma ProveedorZona,
  adentro del Layout; las paginas lo leen con useZona.
*/
export type EstadoZona = {
  /** La zona elegida, o null: sin zona, cada pagina muestra todo el pais. */
  zona: Zona | null;
  /** Los lugares que se pueden elegir. Vacio mientras se cargan. */
  zonas: Zona[];
  /** true cuando ya se sabe si hay zona (la lista cargo, o fallo). */
  lista: boolean;
  /** Un aviso para mostrar, como un link con una zona que ya no existe. */
  aviso: string | null;
  elegir: (zona: Zona | null) => void;
  /** Pide la ubicacion del telefono y elige el lugar mas cercano. */
  usarUbicacion: () => void;
  ubicando: boolean;
  errorUbicacion: string | null;
  cerrarAviso: () => void;
};

export const ContextoZona = createContext<EstadoZona | null>(null);

export function useZona(): EstadoZona {
  const estado = useContext(ContextoZona);
  if (!estado) throw new Error("useZona tiene que usarse adentro de ProveedorZona");
  return estado;
}
