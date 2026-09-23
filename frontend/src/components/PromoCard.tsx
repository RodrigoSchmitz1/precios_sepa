import { useState } from "react";
import { nombreProvincia } from "../utils/provincias";
import { formatearNumero, formatearPesos } from "../utils/formato";
import { nombreLegible } from "../utils/texto";
import type { SucursalMapa } from "../types";
import { EVIDENCIA } from "../utils/evidencia";

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
  /** Numeros de las sucursales de la zona donde rige, solo en el listado del
   *  mapa. Los datos de cada una vienen en la tabla que se pasa aparte. */
  sucursales?: number[];
  total_sucursales?: number;
  /** Solo en el listado agrupado (/promos), no en el del mapa. */
  provincias?: number;
  nivel_evidencia?: "leyenda" | "mercado" | "sin_verificar";
};

function direccionDe(promo: PromoMostrable): string | null {
  const calle = [promo.calle, promo.numero].filter(Boolean).join(" ").trim();
  const partes = [calle || promo.nombre_sucursal, promo.localidad].filter(Boolean);
  return partes.length > 0 ? partes.join(" · ") : null;
}

function PromoCard({
  promo,
  sucursales: tabla,
}: {
  promo: PromoMostrable;
  sucursales?: Record<string, SucursalMapa>;
}) {
  const [abierta, setAbierta] = useState(false);
  const total = promo.total_sucursales ?? 1;
  const direccion = direccionDe(promo);
  const ahorro = promo.precio_lista - promo.precio_promo;
  /*
    Con la promo al mismo precio en varias provincias se nombra una y se cuenta
    el resto. Decir "Buenos Aires" a secas escondería que rige en otras siete, y
    listarlas todas no entra en una linea ni aporta: lo que importa es que no es
    una promo local.
  */
  const otras = (promo.provincias ?? 1) - 1;
  /*
    Con la promo en varias sucursales se dice en cuantas y no la direccion de
    una: la promo es la misma en todas, y repetir la fila por local llenaba
    pantallas enteras con el mismo producto. Donde encontrarla se despliega si
    lo piden.
  */
  const zona =
    total > 1
      ? `en ${formatearNumero(total)} sucursales`
      : direccion ?? nombreProvincia(promo.provincia) + (otras > 0 ? ` y ${otras} provincia${otras > 1 ? "s" : ""} mas` : "");
  const donde = [promo.cadena, promo.categoria, zona].filter(Boolean).join(" · ");

  return (
    <article className="py-4">
      <div className="flex items-baseline gap-4">
      <div className="min-w-0 flex-1">
        {/*
          Un escalon mas de cuerpo en las tres lineas (2026-09-23). El nombre del
          producto es lo que se viene a leer y estaba en 14px, el mismo cuerpo
          que la nota al pie de la pagina; ahora la jerarquia adentro de la fila
          se corresponde con la importancia de cada dato.
        */}
        <h3 className="text-base text-tinta leading-snug">{nombreLegible(promo.descripcion, promo.marca)}</h3>
        <p className="text-sm text-tinta-suave truncate">{donde}</p>
        {/* min-w-0 en el flex: sin eso la leyenda larga no puede encogerse por
            mas truncate que tenga, y empuja la fila hasta meter scroll
            horizontal en toda la pagina. */}
        <p className="flex items-center gap-2 mt-1 min-w-0">
          {promo.nivel_evidencia && (
            <span
              title={EVIDENCIA[promo.nivel_evidencia].ayuda}
              className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-medium ${EVIDENCIA[promo.nivel_evidencia].clase}`}
            >
              {EVIDENCIA[promo.nivel_evidencia].texto}
            </span>
          )}
          {promo.leyenda && <span className="text-xs text-tinta-suave truncate">{promo.leyenda}</span>}
        </p>
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
      </div>

      {/*
        Las sucursales van detras de un click y cerradas por defecto. Es la
        respuesta a "esta cerca de mi casa", que no todo el mundo se hace, y
        abierta por defecto convertia el listado en lo que era antes: la misma
        promo repetida una vez por local.
      */}
      {total > 1 && promo.sucursales && tabla && (
        <div className="mt-2">
          <button
            onClick={() => setAbierta(!abierta)}
            aria-expanded={abierta}
            className="text-xs text-tinta-media hover:text-ahorro transition-colors"
          >
            {abierta ? "Ocultar sucursales" : "Ver donde esta"}
          </button>
          {abierta && (
            /* Con la lista completa, una promo en 400 sucursales no entra de un
               golpe en la fila: se limita el alto y la lista scrollea. */
            <ul className="mt-2 pl-3 border-l border-linea-fuerte space-y-1 max-h-56 overflow-y-auto">
              {promo.sucursales.map((id) => {
                const s = tabla[String(id)];
                if (!s) return null;
                return (
                  <li key={id} className="text-xs text-tinta-suave">
                    {[s.calle, s.numero].filter(Boolean).join(" ") || s.nombre_sucursal}
                    {s.localidad && <span className="text-tinta-media"> · {s.localidad}</span>}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </article>
  );
}

export default PromoCard;
