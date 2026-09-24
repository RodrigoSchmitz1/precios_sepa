import { useEffect, useState } from "react";
import { Link } from "react-router";
import {
  obtenerCanasta,
  obtenerInflacionResumen,
  obtenerProductosDestacados,
  obtenerQuienGana,
} from "../api/client";
import { fechaEnPalabras, formatearNumero, formatearPesos } from "../utils/formato";
import FilaDeCifras from "./FilaDeCifras";
import type { Canasta, InflacionResumen, ProductoComparado, QuienGana } from "../types";

/*
  Portada del sitio.

  Antes era un parrafo y cuatro tarjetas iguales: explicaba de que va el sitio,
  pero no mostraba nada. Ahora la portada trae las cifras del dia y cada seccion
  se presenta con un micrografico hecho con SUS datos reales, no con un dibujo
  decorativo: se ve que el sitio esta vivo antes de entrar a ninguna seccion.

  Las cuatro fuentes que alimentan esto no agregan consultas a BigQuery. Canasta,
  inflacion y quien gana se piden con los MISMOS argumentos que usan sus paginas
  (obtenerQuienGana("") es literalmente la llamada de Mas barato), asi que caen
  en la misma entrada de la cache de la API; los destacados de Mismo producto
  salen del indice en memoria, que se arma con list_rows y no consume cuota.

  Si alguna falla, la portada se muestra igual sin ese numero o sin ese grafico:
  nunca puede dejar el sitio en blanco. Es lo que pasa cuando se agota la cuota
  diaria, y conviene probarlo en ese estado antes de darlo por bueno.
*/

type Datos = {
  canasta?: Canasta[];
  inflacion?: InflacionResumen[];
  quienGana?: QuienGana[];
  destacados?: ProductoComparado[];
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

/** Cuantas categorias lidera cada cadena, en una sola barra apilada.
 *
 *  Va en tinta con opacidad decreciente y no en colores. En este sistema el
 *  verde significa barato y el terracota caro (ver index.css), y aca no hay
 *  nada barato ni caro: hay cuota de categorias. Usar la paleta de precio para
 *  distinguir cadenas le haria decir al grafico algo que no dice. */
function MiniLideres({ lideres }: { lideres: number[] }) {
  const total = lideres.reduce((suma, n) => suma + n, 0);
  if (total === 0) return null;

  // Los desplazamientos se calculan antes de dibujar y no acumulando dentro del
  // map: eso seria mutar durante el render. Son pocas cadenas, asi que recorrer
  // el prefijo de cada una no cuesta nada.
  const segmentos = lideres.map((n, i) => ({
    x: (lideres.slice(0, i).reduce((suma, previo) => suma + previo, 0) / total) * 150,
    ancho: (n / total) * 150,
    opacidad: Math.max(0.85 - i * 0.18, 0.12),
  }));

  return (
    <svg width="150" height="20" viewBox="0 0 150 20" aria-hidden="true" className="shrink-0">
      {segmentos.map((s, i) => (
        <rect
          key={i}
          x={s.x}
          y="6"
          width={Math.max(s.ancho - 1.5, 0.5)}
          height="8"
          className="fill-tinta"
          opacity={s.opacidad}
        />
      ))}
    </svg>
  );
}

/** La brecha de los productos mas dispares: una linea por producto, del precio
 *  mas bajo al mas alto.
 *
 *  No son barras a proposito. Una barra dice "cuanto"; lo que cuenta esta
 *  seccion es "de donde hasta donde", que es la forma de una linea con un
 *  extremo en cada precio. Verde el mas barato y terracota el mas caro, la
 *  misma convencion que el resto del sistema.
 *
 *  Entran tres de los doce destacados, y NO los tres primeros: como la lista
 *  viene ordenada por brecha, los tres mayores dan lineas casi del mismo largo
 *  y el grafico no muestra nada. Con el maximo, la mediana y el minimo se ven
 *  tres largos distintos, y de paso se lee algo cierto: hasta el mas moderado
 *  de los destacados tiene una brecha enorme. */
function MiniBrechas({ diferencias }: { diferencias: number[] }) {
  const maximo = Math.max(...diferencias);
  if (!(maximo > 0)) return null;
  const ordenadas = [...diferencias].sort((a, b) => b - a);
  const muestra = [
    ordenadas[0],
    ordenadas[Math.floor(ordenadas.length / 2)],
    ordenadas[ordenadas.length - 1],
  ];
  return (
    <svg width="150" height="20" viewBox="0 0 150 20" aria-hidden="true" className="shrink-0">
      {muestra.map((d, i) => {
        const y = 4 + i * 6;
        const fin = 4 + (d / maximo) * 142;
        return (
          <g key={i}>
            <line x1="4" x2={fin} y1={y} y2={y} className="stroke-linea-fuerte" />
            <circle cx="4" cy={y} r="2" className="fill-dato-verde" />
            <circle cx={fin} cy={y} r="2" className="fill-alerta" />
          </g>
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
    obtenerQuienGana("")
      .then((quienGana) => {
        if (!cancelado) setDatos((previo) => ({ ...previo, quienGana }));
      })
      .catch(() => {});
    obtenerProductosDestacados()
      .then((destacados) => {
        if (!cancelado) setDatos((previo) => ({ ...previo, destacados }));
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

  /*
    Cuantas categorias lidera cada cadena, de mayor a menor.

    El lider se elige por pct_gana_cuando_compite y no por pct_victorias, igual
    que en la pagina: esta ultima divide por todos los comparables y no por los
    que la cadena ofrece, asi que premia el surtido amplio antes que el precio
    bajo (ver el comentario del endpoint). Se busca el maximo en vez de confiar
    en el orden que manda la API: si ese ORDER BY cambiara, un grafico que se
    apoya en el orden mentiria en silencio.
  */
  const lideres = (() => {
    const mejorPorCategoria = new Map<string, QuienGana>();
    for (const fila of datos.quienGana ?? []) {
      const actual = mejorPorCategoria.get(fila.categoria);
      if (!actual || fila.pct_gana_cuando_compite > actual.pct_gana_cuando_compite) {
        mejorPorCategoria.set(fila.categoria, fila);
      }
    }
    const porCadena = new Map<string, number>();
    for (const fila of mejorPorCategoria.values()) {
      porCadena.set(fila.cadena, (porCadena.get(fila.cadena) ?? 0) + 1);
    }
    return [...porCadena.values()].sort((a, b) => b - a);
  })();

  const brechas = (datos.destacados ?? []).map((p) => p.diferencia_pct);

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
      grafico: lideres.length > 0 ? <MiniLideres lideres={lideres} /> : null,
    },
    {
      ruta: "/mismo-producto",
      titulo: "Mismo producto",
      pregunta: "Cuanto cuesta el mismo codigo de barras en cada cadena",
      grafico: brechas.length > 0 ? <MiniBrechas diferencias={brechas} /> : null,
    },
    {
      ruta: "/inflacion",
      titulo: "Inflacion",
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
                      detalle: `por adulto, en ${masBarata.localidad}`,
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
                <span className="text-sm text-tinta-media leading-snug flex-1 min-w-0">{s.pregunta}</span>
                {/* Ancho fijo aunque la fila no tenga grafico. Si la ranura se encoge
                    cuando falta, los graficos que si estan arrancan en una x distinta
                    en cada fila y la columna se lee rota. Tu canasta es la unica sin
                    grafico a proposito: no tiene un dato propio que mostrar, se arma
                    con lo que carga cada visitante. */}
                <span className="hidden sm:block w-[150px] shrink-0">{s.grafico}</span>
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
