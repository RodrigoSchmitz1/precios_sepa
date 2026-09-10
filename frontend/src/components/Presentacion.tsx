import { Link } from "react-router";

/*
  Presentacion de la portada.

  La portada abria directo con un mapa de pines: quien llegaba por primera vez no
  sabia que estaba mirando, de donde salian los datos ni que mas habia en el
  sitio. Esto lo dice en un parrafo y deja a mano las otras secciones, cada una
  presentada por la pregunta que responde.

  No lleva cifras que cambian todos los dias (localidades, variaciones, costos):
  un texto fijo con un numero de la semana pasada es exactamente el tipo de dato
  desactualizado que este sitio trata de evitar. Las cifras viven en cada seccion,
  que las calcula al momento.
*/

const SECCIONES = [
  {
    ruta: "/canasta",
    titulo: "Canasta basica",
    pregunta: "¿Cuanto cuesta la canasta alimentaria en cada localidad?",
  },
  {
    ruta: "/canasta-personalizada",
    titulo: "Tu canasta",
    pregunta: "Contas que consumis y se cotiza con precios reales de tu zona.",
  },
  {
    ruta: "/quien-gana",
    titulo: "Mas barato",
    pregunta: "¿Que cadena tiene el precio mas bajo en cada categoria?",
  },
  {
    ruta: "/inflacion",
    titulo: "Que se movio",
    pregunta: "¿Que categorias subieron o bajaron de precio?",
  },
];

function Presentacion() {
  return (
    <section className="mb-10" aria-labelledby="titulo-portada">
      <p className="text-xs font-semibold uppercase tracking-wider text-ahorro mb-2">
        Datos oficiales · se actualiza todos los dias
      </p>
      <h1 id="titulo-portada" className="font-display text-4xl sm:text-5xl text-tinta mb-3 max-w-3xl">
        Precios reales de supermercado en Argentina
      </h1>
      <p className="text-tinta-media leading-relaxed max-w-3xl mb-6">
        Las grandes cadenas informan sus precios al programa SEPA de la Secretaria de
        Comercio: unos 14 millones por dia, sucursal por sucursal. Este sitio los toma,
        los limpia y los convierte en respuestas concretas sobre donde hay descuentos,
        cuanto cuesta comer en cada lugar y quien vende mas barato.
      </p>

      {/*
        Dos columnas desde el celular: en una sola, las cuatro tarjetas ocupaban
        casi dos pantallas y empujaban las promos fuera de la vista.
      */}
      <nav aria-label="Secciones" className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
        {SECCIONES.map((s) => (
          <Link
            key={s.ruta}
            to={s.ruta}
            className="group bg-papel border border-linea rounded-xl p-3 sm:p-4 hover:border-linea-fuerte transition-colors"
          >
            <p className="text-sm font-semibold text-tinta mb-1 flex items-center justify-between gap-2">
              {s.titulo}
              <span
                aria-hidden="true"
                className="text-tinta-suave group-hover:text-ahorro group-hover:translate-x-0.5 transition"
              >
                →
              </span>
            </p>
            <p className="text-xs text-tinta-media leading-snug">{s.pregunta}</p>
          </Link>
        ))}
      </nav>
    </section>
  );
}

export default Presentacion;
