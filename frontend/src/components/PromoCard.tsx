import { nombreProvincia } from "../utils/provincias";
import { formatearPesos } from "../utils/formato";
import { nombreLegible } from "../utils/texto";

/*
  Una promo del listado.

  Era una tarjeta con borde, dos chips redondeados y un badge blanco sobre
  verde. Con sesenta seguidas, la pantalla era un collage de cajas y el ojo no
  encontraba donde mirar. Ahora es una fila separada por una linea fina, con el
  precio en serif a la derecha: es la misma densidad, pero el precio manda y las
  filas se escanean de arriba abajo como un listado de diario.

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
  const donde = [promo.cadena, promo.categoria, direccion ?? nombreProvincia(promo.provincia)]
    .filter(Boolean)
    .join(" · ");

  return (
    <article className="flex items-baseline gap-4 py-4">
      <div className="min-w-0 flex-1">
        {/*
          Un escalon mas de cuerpo en las tres lineas (2026-09-23). El nombre del
          producto es lo que se viene a leer y estaba en 14px, el mismo cuerpo
          que la nota al pie de la pagina; ahora la jerarquia adentro de la fila
          se corresponde con la importancia de cada dato.
        */}
        <h3 className="text-base text-tinta leading-snug">{nombreLegible(promo.descripcion, promo.marca)}</h3>
        <p className="text-sm text-tinta-suave truncate">{donde}</p>
        {promo.leyenda && <p className="text-xs text-tinta-suave truncate">{promo.leyenda}</p>}
      </div>

      <div
        className="text-right shrink-0"
        title={ahorro > 0 ? `Ahorras ${formatearPesos(ahorro)} sobre el precio de lista` : undefined}
      >
        {/* El importe en serif, como los demas numeros grandes del sitio. */}
        <p className="font-display text-2xl text-tinta leading-none">{formatearPesos(promo.precio_promo)}</p>
        <p className="numero text-sm text-tinta-suave mt-1">
          <span className="line-through">{formatearPesos(promo.precio_lista)}</span>{" "}
          <span className="text-ahorro font-medium">−{promo.descuento_pct}%</span>
        </p>
      </div>
    </article>
  );
}

export default PromoCard;
