import { useEffect, useState } from "react";
import { obtenerPromosDeProductos } from "../api/client";
import type { PromoCerca } from "../types";
import type { Zona } from "../utils/zona";

/** Las promos de un producto cerca de la zona, o null mientras llegan. Sin id
 *  no pide nada. La usa tambien el titular del detalle, para avisar si una
 *  promo cerca gana (total-con-promos-cerca), sin pedirlas dos veces. */
export function usePromosCerca(idProducto: string | null, zona: Pick<Zona, "latitud" | "longitud"> | null): PromoCerca[] | null {
  const clave = idProducto && zona ? JSON.stringify([idProducto, zona.latitud, zona.longitud]) : "";
  const [estado, setEstado] = useState<{ clave: string; promos: PromoCerca[] } | null>(null);

  useEffect(() => {
    if (!clave) return;
    let cancelado = false;
    const [id, latitud, longitud] = JSON.parse(clave) as [string, number, number];
    obtenerPromosDeProductos([id], { latitud, longitud })
      .then((r) => {
        if (!cancelado) setEstado({ clave, promos: r[id] ?? [] });
      })
      .catch(() => {
        if (!cancelado) setEstado({ clave, promos: [] });
      });
    return () => {
      cancelado = true;
    };
  }, [clave]);

  return clave && estado?.clave === clave ? estado.promos : null;
}
