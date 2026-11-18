import { useEffect, useState } from "react";
import { obtenerPromosDeProductos } from "../api/client";
import type { PromoCerca } from "../types";
import { promosQueConvienen } from "../utils/promosCerca";
import type { Zona } from "../utils/zona";
import PromoCercana from "./PromoCercana";

/** Hasta 3 promos del producto cerca de la zona que lo dejan mas barato que
 *  la cadena mas barata de la zona (openspec promos-de-tu-lista). Sin
 *  ninguna, o si el pedido falla, no muestra nada. */
function PromosCercaDelProducto({
  idProducto,
  zona,
  precioZona,
}: {
  idProducto: string;
  zona: Pick<Zona, "latitud" | "longitud">;
  precioZona: number | undefined;
}) {
  const clave = JSON.stringify([idProducto, zona.latitud, zona.longitud]);
  const [estado, setEstado] = useState<{ clave: string; promos: PromoCerca[] } | null>(null);

  useEffect(() => {
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

  const promos = estado?.clave === clave ? promosQueConvienen(estado.promos, precioZona) : [];
  if (promos.length === 0) return null;
  return (
    <section aria-labelledby="titulo-promos-cerca" className="mb-6 pl-3 border-l-2 border-ahorro">
      <h3 id="titulo-promos-cerca" className="text-base font-bold text-tinta mb-2">
        🏷️ En promo cerca tuyo
      </h3>
      <ul className="space-y-3">
        {promos.map((promo) => (
          <li key={`${promo.cadena}-${promo.nombre_sucursal}`}>
            <PromoCercana promo={promo} />
          </li>
        ))}
      </ul>
    </section>
  );
}

export default PromosCercaDelProducto;
