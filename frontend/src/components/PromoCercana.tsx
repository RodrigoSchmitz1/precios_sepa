import type { PromoCerca } from "../types";
import { EVIDENCIA } from "../utils/evidencia";
import { formatearPesos } from "../utils/formato";
import { direccionPromo, textoOtrasSucursales, textoVigencia } from "../utils/promosCerca";
import { etiquetaMayorista } from "../utils/mayoristas";

/*
  Una promo de un producto de tu lista o del detalle, en una sucursal cerca de
  tu zona (openspec promos-de-tu-lista). Dice donde, cuanto y hasta cuando, con
  el mismo sello de evidencia que la pagina Promos.
*/
function PromoCercana({ promo }: { promo: PromoCerca }) {
  const evidencia = EVIDENCIA[promo.nivel_evidencia];
  const detalles = [direccionPromo(promo), textoOtrasSucursales(promo), textoVigencia(promo)].filter(Boolean);
  return (
    <div className="text-sm leading-snug">
      <p className="text-tinta">
        <span className="font-semibold text-ahorro numero">−{Math.round(promo.descuento_pct)}%</span> en{" "}
        <strong className="font-semibold">{promo.cadena}</strong>
        {etiquetaMayorista(promo) && <span className="text-tinta-media"> ({etiquetaMayorista(promo)})</span>}:{" "}
        <strong className="font-semibold numero">{formatearPesos(promo.precio_promo)}</strong>{" "}
        <span className="text-tinta-suave line-through numero">{formatearPesos(promo.precio_lista)}</span>
        {promo.requiere_compra_multiple && <span className="text-tinta-media"> · llevando más de una</span>}
      </p>
      <p className="text-xs text-tinta-suave mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="min-w-0">{detalles.join(" · ")}</span>
        <span
          title={evidencia.ayuda}
          className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-medium ${evidencia.clase}`}
        >
          {evidencia.texto}
        </span>
      </p>
    </div>
  );
}

export default PromoCercana;
