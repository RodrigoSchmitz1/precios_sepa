import { nombreProvincia } from "../utils/provincias";
import { formatearPesos } from "../utils/formato";

/*
  Acepta tanto la promo agrupada por cadena/provincia (/promos) como la que
  viene con sucursal y coordenadas (/promos/mapa). Los campos de sucursal son
  opcionales: antes la pagina del mapa adaptaba PromoMapa a Promo y tiraba la
  direccion, que es justamente el dato que dice donde encontrar la promo.
*/
type PromoMostrable = {
  descripcion: string;
  marca: string;
  categoria: string | null;
  cadena: string;
  provincia: string;
  precio_lista: number;
  precio_promo: number;
  descuento_pct: number;
  leyenda: string;
  localidad?: string;
  nombre_sucursal?: string;
  calle?: string;
  numero?: string;
};

function direccionDe(promo: PromoMostrable): string | null {
  const calle = [promo.calle, promo.numero].filter(Boolean).join(" ").trim();
  const partes = [calle || promo.nombre_sucursal, promo.localidad].filter(Boolean);
  return partes.length > 0 ? partes.join(" · ") : null;
}

function PromoCard({ promo }: { promo: PromoMostrable }) {
  const direccion = direccionDe(promo);
  const ahorro = promo.precio_lista - promo.precio_promo;

  return (
    <article className="bg-papel rounded-xl border border-linea p-4 hover:border-linea-fuerte transition-colors">
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex flex-wrap gap-1.5">
          {promo.categoria && (
            <span className="text-[11px] font-medium text-tinta-media bg-papel-hundido rounded-full px-2 py-0.5">
              {promo.categoria}
            </span>
          )}
          <span className="text-[11px] font-medium text-tinta-media bg-papel-hundido rounded-full px-2 py-0.5">
            {promo.cadena}
          </span>
        </div>
        <span className="shrink-0 numero text-xs font-bold text-white bg-ahorro rounded-full px-2 py-1">
          −{promo.descuento_pct}%
        </span>
      </div>

      <h3 className="font-semibold text-tinta leading-snug">{promo.descripcion}</h3>
      {promo.marca && <p className="text-xs text-tinta-suave mt-0.5">{promo.marca}</p>}

      <div className="flex items-baseline gap-2 mt-2">
        <span className="numero text-2xl font-bold text-ahorro">
          {formatearPesos(promo.precio_promo)}
        </span>
        <span className="numero text-sm text-tinta-suave line-through">
          {formatearPesos(promo.precio_lista)}
        </span>
        {ahorro > 0 && (
          <span className="numero text-xs text-tinta-suave">
            ahorras {formatearPesos(ahorro)}
          </span>
        )}
      </div>

      <p className="text-xs text-tinta-suave mt-2">
        {direccion ?? nombreProvincia(promo.provincia)}
        {direccion && ` · ${nombreProvincia(promo.provincia)}`}
      </p>
      {promo.leyenda && <p className="text-[11px] text-tinta-suave mt-0.5">{promo.leyenda}</p>}
    </article>
  );
}

export default PromoCard;
