import type { Promo } from "../types";

type Props = {
  promo: Promo;
};

function PromoCard({ promo }: Props) {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 flex justify-between items-center">
      <div>
        <p className="font-semibold text-gray-900">{promo.descripcion}</p>
        <p className="text-sm text-gray-500">
          {promo.marca} · {promo.cadena} · {promo.provincia}
        </p>
        <p className="text-xs text-gray-400 mt-1">{promo.leyenda}</p>
      </div>

      <div className="text-right shrink-0 ml-4">
        <p className="text-sm text-gray-400 line-through">${promo.precio_lista}</p>
        <p className="text-lg font-bold text-green-600">${promo.precio_promo}</p>
        <span className="inline-block mt-1 text-xs font-semibold text-white bg-green-600 rounded-full px-2 py-0.5">
          {promo.descuento_pct}% OFF
        </span>
      </div>
    </div>
  );
}

export default PromoCard;
