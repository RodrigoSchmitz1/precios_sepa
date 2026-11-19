import { usePromosCerca } from "../contexto/usePromosCerca";
import type { PromoCerca } from "../types";
import { promosQueConvienen } from "../utils/promosCerca";
import type { Zona } from "../utils/zona";
import PromoCercana from "./PromoCercana";

/** Hasta 3 promos del producto cerca de la zona que lo dejan mas barato que
 *  la cadena mas barata de la zona (openspec promos-de-tu-lista). Sin
 *  ninguna, o si el pedido falla, no muestra nada. Con `promos` usa esas y no
 *  pide nada. */
function PromosCercaDelProducto({
  idProducto,
  zona,
  precioZona,
  promos: dadas,
}: {
  idProducto: string;
  zona: Pick<Zona, "latitud" | "longitud">;
  precioZona: number | undefined;
  promos?: PromoCerca[] | null;
}) {
  const propias = usePromosCerca(dadas === undefined ? idProducto : null, zona);
  const todas = dadas === undefined ? propias : dadas;
  const promos = todas ? promosQueConvienen(todas, precioZona) : [];
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
