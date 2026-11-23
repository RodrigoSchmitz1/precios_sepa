import { useEffect, useState } from "react";
import { obtenerVidriera } from "../api/client";
import type { Vidriera } from "../types";
import { useZona } from "./zona";

export type EstadoVidriera = { vidriera: Vidriera | null; error: string | null };

/*
  La vidriera de Promos, pedida una sola vez para las dos partes de la portada:
  las promos del dia (arriba, pegadas a la presentacion) y las filas por
  categoria y por super (abajo). Se espera a saber si hay zona: si no, se
  pediria la del pais y enseguida la de la zona.
*/
export function useVidriera(activa: boolean): EstadoVidriera {
  const { zona, lista } = useZona();
  const [estado, setEstado] = useState<EstadoVidriera>({ vidriera: null, error: null });

  const firma = activa && lista ? (zona ? `${zona.latitud},${zona.longitud}` : "pais") : "";
  const [firmaPedida, setFirmaPedida] = useState("");
  if (firma !== firmaPedida) {
    setFirmaPedida(firma);
    setEstado({ vidriera: null, error: null });
  }

  useEffect(() => {
    if (!firma) return;
    let cancelado = false;
    obtenerVidriera(zona)
      .then((v) => {
        if (!cancelado) setEstado({ vidriera: v, error: null });
      })
      .catch((e) => {
        if (!cancelado) setEstado({ vidriera: null, error: e.message });
      });
    return () => {
      cancelado = true;
    };
  }, [firma, zona]);

  return estado;
}
