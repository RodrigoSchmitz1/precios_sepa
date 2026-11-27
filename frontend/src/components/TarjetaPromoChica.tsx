import { Link } from "react-router";
import type { PromoVidriera } from "../types";
import { EVIDENCIA } from "../utils/evidencia";
import { formatearNumero, formatearPesos } from "../utils/formato";
import { nombreLegible } from "../utils/texto";
import { direccionPromo, textoVigencia } from "../utils/promosCerca";
import { etiquetaMayorista } from "../utils/mayoristas";

/*
  Una promo de la vidriera (openspec promos-navegables-y-mes-en-gastos): mas
  chica que la fila del listado, para que entren varias por pantalla. Lleva al
  detalle del producto, donde estan el precio en cada cadena, sus promos cerca y
  "Avisame cuando este de oferta": de la vidriera se sigue navegando.
*/
/** clase: el ancho cuando va en una fila que se desliza de costado. */
function TarjetaPromoChica({ promo, clase: ancho = "" }: { promo: PromoVidriera; clase?: string }) {
  const evidencia = EVIDENCIA[promo.nivel_evidencia];
  const donde =
    promo.total_sucursales > 1 ? `en ${formatearNumero(promo.total_sucursales)} sucursales` : direccionPromo({ ...promo, barrio: null });
  const vigencia = textoVigencia(promo);
  const contenido = (
    <>
      <div className="flex items-start justify-between gap-2">
        <span className="inline-block bg-ahorro-tenue text-ahorro text-sm font-extrabold rounded-lg px-2 py-0.5">
          −{Math.round(promo.descuento_pct)}%
        </span>
        <span className="text-right">
          <span className="block font-display text-xl text-tinta leading-none">{formatearPesos(promo.precio_promo)}</span>
          <span className="block numero text-xs text-tinta-suave line-through mt-0.5">{formatearPesos(promo.precio_lista)}</span>
        </span>
      </div>
      <p className="mt-2 text-sm font-bold text-tinta leading-snug line-clamp-2">{nombreLegible(promo.descripcion, promo.marca)}</p>
      <p className="text-xs text-tinta-suave truncate">
        <strong className="font-semibold text-tinta-media">{promo.cadena}</strong>
        {etiquetaMayorista(promo) && <span> · {etiquetaMayorista(promo)}</span>} · {donde}
      </p>
      <p className="mt-1 flex items-center gap-1.5 min-w-0 text-[11px] text-tinta-suave">
        <span title={evidencia.ayuda} className={`shrink-0 rounded-full border px-1.5 py-px font-medium ${evidencia.clase}`}>
          {evidencia.texto}
        </span>
        {vigencia && <span className="truncate">{vigencia}</span>}
      </p>
    </>
  );
  const clase = `tarjeta block p-3 ${ancho}`;
  if (!promo.id_producto) return <article className={clase}>{contenido}</article>;
  return (
    <Link
      to={`/mismo-producto?p=${encodeURIComponent(promo.id_producto)}`}
      className={`${clase} hover:shadow-flotante transition-shadow`}
    >
      {contenido}
    </Link>
  );
}

export default TarjetaPromoChica;
