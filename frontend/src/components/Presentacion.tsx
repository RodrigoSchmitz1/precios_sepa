import { useEffect, useState } from "react";
import { Link } from "react-router";
import { obtenerCanasta, obtenerInflacionResumen } from "../api/client";
import { fechaEnPalabras, formatearNumero, formatearPesos } from "../utils/formato";
import FilaDeCifras from "./FilaDeCifras";
import type { Canasta, InflacionResumen } from "../types";

/*
  Portada del sitio.

  Antes era un parrafo y cuatro tarjetas iguales: explicaba de que va el sitio,
  pero no mostraba nada. Ahora la portada trae las cifras del dia y cada seccion
  se presenta con un micrografico hecho con SUS datos reales, no con un dibujo
  decorativo: se ve que el sitio esta vivo antes de entrar a ninguna seccion.

  Las dos consultas que alimentan esto (canasta e inflacion) son las mismas que
  hacen sus paginas, con los mismos argumentos, asi que comparten la entrada de
  la cache de la API y no agregan consultas a BigQuery. Si alguna falla, la
  portada se muestra igual sin sus numeros: nunca puede dejar el sitio en blanco.
*/

type Datos = {
  canasta?: Canasta[];
  inflacion?: InflacionResumen[];
};

/** Tira de puntos en miniatura. Se muestrea: 94 puntos en 150px se pisan entre
 *  si y forman una mancha gris, que no se lee como distribucion. Con uno de
 *  cada tres se ve la forma, y los dos extremos van siempre. */
function MiniTira({ valores }: { valores: number[] }) {
  const minimo = Math.min(...valores);
  const maximo = Math.max(...valores);
  const paso = Math.max(1, Math.ceil(valores.length / 30));
  const muestra = valores.filter((_, i) => i % paso === 0);
  const x = (v: number) => (maximo > minimo ? 5 + ((v - minimo) / (maximo - minimo)) * 140 : 75);
  return (
    <svg width="150" height="20" viewBox="0 0 150 20" aria-hidden="true" className="shrink-0">
      <line x1="2" x2="148" y1="15" y2="15" className="stroke-linea" />
      {muestra.map((v, i) => (
        <circle key={i} cx={x(v)} cy={9} r="2.5" className="fill-tinta-suave/45" />
      ))}
      <circle cx={x(minimo)} cy={9} r="4" className="fill-dato-verde" />
      <circle cx={x(maximo)} cy={9} r="4" className="fill-alerta" />
    </svg>
  );
}

/** Barras divergentes en miniatura: una categoria, una barra. */
function MiniDivergente({ variaciones }: { variaciones: number[] }) {
  const maximo = Math.max(...variaciones.map(Math.abs), 0.01);
  const ancho = 150 / variaciones.length;
  return (
    <svg width="150" height="20" viewBox="0 0 150 20" aria-hidden="true" className="shrink-0">
      <line x1="0" x2="150" y1="10" y2="10" className="stroke-linea-fuerte" />
      {variaciones.map((v, i) => {
        const alto = (Math.abs(v) / maximo) * 9;
        return (
          <rect
            key={i}
            x={i * ancho}
            y={v >= 0 ? 10 - alto : 10}
            width={Math.max(ancho - 1, 1)}
            height={alto}
            className={v >= 0 ? "fill-alerta" : "fill-dato-verde"}
          />
        );
      })}
    </svg>
  );
}

function Presentacion() {
  const [datos, setDatos] = useState<Datos>({});

  useEffect(() => {
    let cancelado = false;
    obtenerCanasta({ limite: 2000 })
      .then((canasta) => {
        if (!cancelado) setDatos((previo) => ({ ...previo, canasta }));
      })
      .catch(() => {
        // La portada no muestra el error: las secciones lo explican cuando se
        // entra a ellas, y un cartel rojo arriba de todo asusta mas de lo que
        // informa.
      });
    obtenerInflacionResumen()
      .then((inflacion) => {
        if (!cancelado) setDatos((previo) => ({ ...previo, inflacion }));
      })
      .catch(() => {});
    return () => {
      cancelado = true;
    };
  }, []);

  const canasta = datos.canasta ?? [];
  const inflacion = datos.inflacion ?? [];
  const masBarata = canasta[0];
  const masCara = canasta[canasta.length - 1];
  const brecha =
    masBarata && masCara && masBarata.costo_canasta_total > 0
      ? Math.round(
          ((masCara.costo_canasta_total - masBarata.costo_canasta_total) / masBarata.costo_canasta_total) * 100
        )
      : null;
  const subieron = inflacion.filter((f) => f.variacion_pct >= 0.005).length;

  const secciones = [
    {
      ruta: "/canasta",
      titulo: "Canasta basica",
      pregunta: "Cuanto cuesta comer en cada localidad",
      grafico:
        canasta.length > 1 ? <MiniTira valores={canasta.map((c) => c.costo_canasta_total)} /> : null,
    },
    {
      ruta: "/canasta-personalizada",
      titulo: "Tu canasta",
      pregunta: "Contas que consumis y se cotiza con precios reales de tu zona",
      grafico: null,
    },
    {
      ruta: "/quien-gana",
      titulo: "Mas barato",
      pregunta: "Que cadena tiene el precio mas bajo en cada categoria",
      grafico: null,
    },
    {
      ruta: "/mismo-producto",
      titulo: "Mismo producto",
      pregunta: "Cuanto cuesta el mismo codigo de barras en cada cadena",
      grafico: null,
    },
    {
      ruta: "/inflacion",
      titulo: "Que se movio",
      pregunta: "Que categorias subieron y cuales bajaron",
      grafico:
        inflacion.length > 1 ? <MiniDivergente variaciones={inflacion.map((f) => f.variacion_pct)} /> : null,
    },
  ];

  return (
    <section className="mb-10" aria-labelledby="titulo-portada">
      <p className="text-xs font-semibold uppercase tracking-wider text-tinta-suave mb-3">
        Datos oficiales del SEPA
        {masBarata && fechaEnPalabras(masBarata.fecha_datos) && ` · precios del ${fechaEnPalabras(masBarata.fecha_datos)}`}
      </p>

      <h1
        id="titulo-portada"
        className="font-display text-4xl sm:text-5xl lg:text-6xl leading-[1.05] text-tinta mb-4 max-w-3xl text-balance"
      >
        Precios reales de supermercado en Argentina
      </h1>

      <p className="text-tinta-media leading-relaxed max-w-2xl mb-7">
        Las cadenas informan sus precios al programa SEPA de la Secretaria de Comercio: unos 14 millones por dia,
        sucursal por sucursal. Este sitio los toma, los limpia y los convierte en respuestas concretas sobre donde hay
        descuentos, cuanto cuesta comer en cada lugar y quien vende mas barato.
      </p>

      {(brecha !== null || inflacion.length > 0) && (
        <div className="mb-8">
          <FilaDeCifras
            cifras={[
              ...(brecha !== null && masBarata && masCara
                ? [
                    {
                      etiqueta: "Canasta mas barata",
                      valor: formatearPesos(masBarata.costo_canasta_total),
                      detalle: masBarata.localidad,
                    },
                    { etiqueta: "Brecha entre localidades", valor: `${brecha}%`, detalle: `hasta ${masCara.localidad}` },
                    {
                      etiqueta: "Localidades medidas",
                      valor: formatearNumero(canasta.length),
                      detalle: "con la canasta completa",
                    },
                  ]
                : []),
              ...(inflacion.length > 0
                ? [
                    {
                      etiqueta: "Categorias al alza",
                      valor: `${subieron} de ${inflacion.length}`,
                      detalle: `desde el ${fechaEnPalabras(inflacion[0].fecha_inicio)}`,
                    },
                  ]
                : []),
            ]}
          />
        </div>
      )}

      <nav aria-label="Secciones">
        <ul>
          {secciones.map((s) => (
            <li key={s.ruta} className="border-b border-linea first:border-t">
              <Link
                to={s.ruta}
                className="group flex items-center gap-4 sm:gap-6 py-3.5 hover:bg-papel-hundido transition-colors"
              >
                <span className="font-display text-xl text-tinta w-36 sm:w-44 shrink-0">{s.titulo}</span>
                <span className="text-xs sm:text-sm text-tinta-media leading-snug flex-1 min-w-0">{s.pregunta}</span>
                {s.grafico && <span className="hidden sm:block">{s.grafico}</span>}
                <span
                  aria-hidden="true"
                  className="text-tinta-suave group-hover:text-ahorro group-hover:translate-x-0.5 transition shrink-0"
                >
                  →
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </section>
  );
}

export default Presentacion;
