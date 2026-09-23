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
  /** Solo en el listado agrupado (/promos), no en el del mapa. */
  provincias?: number;
  nivel_evidencia?: "leyenda" | "mercado" | "sin_verificar";
};

/*
  Con que evidencia se sostiene el descuento. Es la unica dimension del sitio
  donde la paleta categorica entra limpia: son TRES valores, contra los trece
  rubros y las dieciseis cadenas, que no se pueden pintar con cuatro slots sin
  inventar tonos que no pasan los chequeos de daltonismo.
  
  El color va SIEMPRE con su palabra, nunca solo: quien no distingue el verde
  del ocre tiene que poder leer lo mismo. Y el orden es de mayor a menor
  respaldo, asi que el color acompana una escala de confianza y no una
  identidad.
*/
const EVIDENCIA = {
  leyenda: {
    texto: "declarada",
    clase: "bg-ahorro-tenue text-ahorro border-ahorro-borde",
    ayuda: "La cadena informa el porcentaje de descuento y coincide con la diferencia entre sus propios precios.",
  },
  mercado: {
    texto: "respaldada",
    clase: "bg-dato-azul-tenue text-dato-azul border-dato-azul/25",
    ayuda: "El precio de promo se sostiene frente al del mismo producto en otras empresas, no solo frente a la lista propia.",
  },
  sin_verificar: {
    texto: "sin verificar",
    clase: "bg-aviso-tenue text-aviso border-aviso/25",
    ayuda: "Solo se sabe que el descuento es chico como para no ser inverosimil. La cadena no lo declara y el mercado no lo respalda.",
  },
} as const;

function direccionDe(promo: PromoMostrable): string | null {
  const calle = [promo.calle, promo.numero].filter(Boolean).join(" ").trim();
  const partes = [calle || promo.nombre_sucursal, promo.localidad].filter(Boolean);
  return partes.length > 0 ? partes.join(" · ") : null;
}

function PromoCard({ promo }: { promo: PromoMostrable }) {
  const direccion = direccionDe(promo);
  const ahorro = promo.precio_lista - promo.precio_promo;
  /*
    Con la promo al mismo precio en varias provincias se nombra una y se cuenta
    el resto. Decir "Buenos Aires" a secas escondería que rige en otras siete, y
    listarlas todas no entra en una linea ni aporta: lo que importa es que no es
    una promo local.
  */
  const otras = (promo.provincias ?? 1) - 1;
  const zona = direccion ?? nombreProvincia(promo.provincia) + (otras > 0 ? ` y ${otras} provincia${otras > 1 ? "s" : ""} mas` : "");
  const donde = [promo.cadena, promo.categoria, zona].filter(Boolean).join(" · ");

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
    </article>
  );
}

export default PromoCard;
