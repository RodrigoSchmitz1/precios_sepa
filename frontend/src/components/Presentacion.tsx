import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Link, useNavigate } from "react-router";
import {
  buscarProductos,
  obtenerInflacionResumen,
  obtenerProducto,
  obtenerProductosDestacados,
  obtenerQuienGana,
} from "../api/client";
import { fechaEnPalabras, formatearNumero, formatearPesos, tamanoQueFalta } from "../utils/formato";
import { esMayorista, liderEn } from "../utils/mayoristas";
import { nombreLegible } from "../utils/texto";
import EtiquetaMayorista from "./EtiquetaMayorista";
import type { InflacionResumen, ProductoComparado, ProductoDetalle, QuienGana } from "../types";

/*
  Portada del sitio.

  Antes era un parrafo y cuatro tarjetas iguales: explicaba de que va el sitio,
  pero no mostraba nada. Ahora la portada trae las cifras del dia y cada seccion
  se presenta con un micrografico hecho con SUS datos reales, no con un dibujo
  decorativo: se ve que el sitio esta vivo antes de entrar a ninguna seccion.

  Las fuentes que alimentan esto no agregan consultas a BigQuery. Inflacion y
  quien gana se piden con los MISMOS argumentos que usan sus paginas
  (obtenerQuienGana("") es literalmente la llamada de Mas barato), asi que caen
  en la misma entrada de la cache de la API; los destacados y el ejemplo de
  Mismo producto salen del indice en memoria, que se arma con list_rows y no
  consume cuota.

  Si alguna falla, la portada se muestra igual sin ese numero o sin ese grafico:
  nunca puede dejar el sitio en blanco. Es lo que pasa cuando se agota la cuota
  diaria, y conviene probarlo en ese estado antes de darlo por bueno.

  SIN CANASTA BASICA (2026-10-08). La seccion se retiro: SEPA informa cadenas
  grandes con precios casi iguales en todo el pais, asi que no podia mostrar las
  diferencias regionales que prometia (Chubut salia mas barato que CABA). Las
  cifras de arriba salen ahora de las secciones que quedan.

  ESTILO "APP" (2026-10-14). La portada pasa a ser una cabecera con el degrade
  de la marca: titular corto, un buscador que lleva a Mismo producto y, a la
  derecha, un producto real (la Coca Cola de 2,25 L, el mismo ejemplo que usa
  Mismo producto) con su precio en la cadena mas barata, una del medio y la mas
  cara. Debajo, tres cifras en tarjetas que se montan sobre el degrade, y las
  secciones como tarjetas con icono y su micrografico.

  La cifra de "Mismo producto" ya no sale del primer destacado: ese es por
  definicion el caso mas extremo del dia y solia tener un nombre roto de la
  fuente ("Frutilla . . bja 250 grm"), en letra grande en la portada. El
  ejemplo fijo es un producto que todos conocen y su brecha es tipica, no la
  maxima.
*/

/** El producto de la tarjeta de la portada: conocido por todos y en casi todas
 *  las cadenas. Es el primer ejemplo de Mismo producto. */
const EJEMPLO_PORTADA = "coca cola 2.25";

type Datos = {
  inflacion?: InflacionResumen[];
  quienGana?: QuienGana[];
  destacados?: ProductoComparado[];
  ejemplo?: ProductoDetalle;
};

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
            className={v >= 0 ? "fill-alerta" : "fill-ahorro"}
          />
        );
      })}
    </svg>
  );
}

/** Cuantas categorias lidera cada cadena, en una sola barra apilada.
 *
 *  Va en un solo tono con opacidad decreciente y no en colores. En este sistema
 *  el verde significa barato y el rosa caro (ver index.css), y aca no hay nada
 *  barato ni caro: hay cuota de categorias. Usar la paleta de precio para
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
          rx="2"
          className="fill-marca"
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
 *  extremo en cada precio. Verde el mas barato y rosa el mas caro, la misma
 *  convencion que el resto del sistema.
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
            <circle cx="4" cy={y} r="2" className="fill-ahorro" />
            <circle cx={fin} cy={y} r="2" className="fill-alerta" />
          </g>
        );
      })}
    </svg>
  );
}

/** Un producto real con su precio en tres cadenas: la mas barata, una del medio
 *  y la mas cara. Va sobre el degrade, en una tarjeta translucida. Solo cuentan
 *  los precios creibles, igual que en Mismo producto. */
function TarjetaEjemplo({ producto }: { producto: ProductoDetalle }) {
  const precios = producto.precios
    .filter((p) => p.precio_creible)
    .sort((a, b) => a.precio_mediano - b.precio_mediano);
  if (precios.length < 2) return null;
  const filas =
    precios.length >= 3
      ? [precios[0], precios[Math.floor(precios.length / 2)], precios[precios.length - 1]]
      : precios;
  const maximo = filas[filas.length - 1].precio_mediano;
  const tamano = tamanoQueFalta(producto.descripcion, producto.cantidad_normalizada, producto.unidad_normalizada);
  const nombre = nombreLegible(producto.descripcion, producto.marca) + (tamano ? ` (${tamano})` : "");
  return (
    <Link
      to={`/mismo-producto?p=${encodeURIComponent(producto.id_producto)}`}
      className="block rounded-[1.75rem] bg-white/12 border border-white/25 backdrop-blur-md p-5 sm:p-6 text-white hover:bg-white/16 transition-colors"
    >
      <p className="text-sm font-semibold text-white/85 line-clamp-1">{nombre}</p>
      <p className="font-display text-5xl sm:text-6xl leading-none mt-2">+{Math.round(producto.diferencia_pct)}%</p>
      <p className="text-sm font-semibold text-white/85 mt-1">
        según dónde la compres · {producto.cadenas} cadenas
      </p>
      <ul className="mt-4 space-y-3">
        {filas.map((p) => (
          <li key={p.cadena}>
            <span className="flex justify-between gap-3 text-sm font-semibold">
              <span className="truncate">
                {p.cadena}
                {esMayorista(p.cadena) && <EtiquetaMayorista sobreColor />}
              </span>
              <span className="numero shrink-0">{formatearPesos(p.precio_mediano)}</span>
            </span>
            <span className="block h-2.5 mt-1.5 rounded-full bg-white/20 overflow-hidden" aria-hidden="true">
              <span
                className="block h-full rounded-full bg-white"
                style={{ width: `${(p.precio_mediano / maximo) * 100}%` }}
              />
            </span>
          </li>
        ))}
      </ul>
    </Link>
  );
}

function Presentacion() {
  const [datos, setDatos] = useState<Datos>({});
  const [texto, setTexto] = useState("");
  const navegar = useNavigate();

  useEffect(() => {
    let cancelado = false;
    // La portada no muestra los errores: las secciones los explican cuando se
    // entra a ellas, y un cartel rojo arriba de todo asusta mas de lo que informa.
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
    buscarProductos(EJEMPLO_PORTADA)
      .then((r) => (r.length > 0 ? obtenerProducto(r[0].id_producto) : undefined))
      .then((ejemplo) => {
        if (!cancelado && ejemplo) setDatos((previo) => ({ ...previo, ejemplo }));
      })
      .catch(() => {});
    return () => {
      cancelado = true;
    };
  }, []);

  const inflacion = datos.inflacion ?? [];
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
  const ranking = [...porCadena.entries()].sort((a, b) => b[1] - a[1]);
  const lideres = ranking.map(([, n]) => n);
  /*
    Quien gana, con la misma cuenta que Mas barato (liderEn: un empate cuenta
    para las dos). Si gana un mayorista, la primera tarjeta es el super que
    gana sin ellos: es la respuesta para quien hace la compra en el super de
    siempre. El mayorista se sigue mostrando, al lado y marcado como tal.
  */
  const filasQG = datos.quienGana ?? [];
  const categoriasQG = [...new Set(filasQG.map((f) => f.categoria))];
  const lider = liderEn(filasQG, categoriasQG);
  const liderSuper =
    lider && esMayorista(lider[0]) ? liderEn(filasQG.filter((f) => !esMayorista(f.cadena)), categoriasQG) : undefined;
  // Productos comparables: el total de cada categoria, una vez por categoria.
  // Es la misma cuenta que el titular de Mas barato.
  const comparables = [...mejorPorCategoria.values()].reduce((suma, f) => suma + f.total_productos_categoria, 0);
  const fechaDatos = fechaEnPalabras(datos.ejemplo?.fecha_datos ?? datos.inflacion?.[0]?.fecha_fin ?? "");

  const brechas = (datos.destacados ?? []).map((p) => p.diferencia_pct);

  const secciones = [
    {
      ruta: "/canasta-personalizada",
      titulo: "Tu canasta",
      pregunta: "Cuánto te cuesta el mes con lo que consumís, en tu zona",
      icono: "🧾",
      fondo: "bg-marca-tenue",
      grafico: null,
    },
    {
      ruta: "/quien-gana",
      titulo: "Más barato",
      pregunta: "Qué cadena gana en cada categoría",
      icono: "🏷️",
      fondo: "bg-[#e0f7fa]",
      grafico: lideres.length > 0 ? <MiniLideres lideres={lideres} /> : null,
    },
    {
      ruta: "/mismo-producto",
      titulo: "Mismo producto",
      pregunta: "Un código de barras, todas las cadenas",
      icono: "🔎",
      fondo: "bg-[#fff1db]",
      grafico: brechas.length > 0 ? <MiniBrechas diferencias={brechas} /> : null,
    },
    {
      ruta: "/inflacion",
      titulo: "Inflación",
      pregunta: "Qué subió y qué bajó en el súper",
      icono: "📊",
      fondo: "bg-alerta-tenue",
      grafico:
        inflacion.length > 1 ? <MiniDivergente variaciones={inflacion.map((f) => f.variacion_pct)} /> : null,
    },
  ];

  type CifraPortada = { etiqueta: string; valor: ReactNode; detalle: string; chip: string; chipClase: string };
  const cifras: CifraPortada[] = [];
  if (lider && liderSuper) {
    cifras.push(
      {
        etiqueta: "El súper más barato",
        valor: liderSuper[0],
        detalle: `en ${liderSuper[1]} de ${categoriasQG.length} categorías, sin contar mayoristas`,
        chip: "🏆 #1 del día",
        chipClase: "bg-ahorro-tenue text-ahorro",
      },
      {
        etiqueta: "Contando mayoristas",
        valor: lider[0],
        detalle: `gana en ${lider[1]} de ${categoriasQG.length} categorías`,
        chip: "📦 mayorista",
        chipClase: "bg-[#fff1db] text-aviso",
      }
    );
  } else if (lider) {
    cifras.push({
      etiqueta: "Más barata en más categorías",
      valor: lider[0],
      detalle: `en ${lider[1]} de ${categoriasQG.length} categorías`,
      chip: "🏆 #1 del día",
      chipClase: "bg-ahorro-tenue text-ahorro",
    });
  }
  if (inflacion.length > 0) {
    cifras.push({
      etiqueta: "Categorías que subieron",
      valor: `${subieron} de ${inflacion.length}`,
      detalle: `desde el ${fechaEnPalabras(inflacion[0].fecha_inicio)}`,
      chip: "▲ suben",
      chipClase: "bg-alerta-tenue text-alerta",
    });
  }
  // Sin mayorista en el podio queda lugar para una tercera cifra.
  if (cifras.length < 3 && comparables > 0) {
    cifras.push({
      etiqueta: "Productos comparados",
      valor: formatearNumero(comparables),
      detalle: "en dos o más cadenas",
      chip: "✓ mismo código de barras",
      chipClase: "bg-marca-tenue text-marca",
    });
  }

  const buscar = (e: FormEvent) => {
    e.preventDefault();
    const consulta = texto.trim();
    if (consulta.length >= 2) navegar(`/mismo-producto?q=${encodeURIComponent(consulta)}`);
  };

  return (
    <section className="mb-12" aria-labelledby="titulo-portada">
      {/* A sangre, como la cabecera de las otras paginas (ver Titular). */}
      <div className="relative overflow-hidden fondo-marca -mt-10 mx-[calc(50%-50vw)] px-5 pt-10 sm:pt-14 pb-28 sm:pb-32 rounded-b-[2.5rem]">
        <span aria-hidden="true" className="absolute -right-24 -top-40 w-[32rem] h-[32rem] rounded-full bg-white/[0.07]" />
        <span aria-hidden="true" className="absolute right-[30%] -bottom-44 w-80 h-80 rounded-full bg-white/[0.06]" />
        <div className="relative max-w-6xl mx-auto grid lg:grid-cols-[1.1fr_0.9fr] gap-8 lg:gap-12 items-center">
          <div className="text-white">
            <p className="inline-block text-xs font-bold bg-white/15 rounded-full px-3 py-1 mb-4">
              Precios oficiales del SEPA{fechaDatos && ` · ${fechaDatos}`}
            </p>
            <h1
              id="titulo-portada"
              className="font-display text-4xl sm:text-5xl lg:text-[3.5rem] leading-[1.04] text-balance"
            >
              Comprá mejor. Sabé dónde está más barato.
            </h1>
            <p className="text-base sm:text-lg text-white/85 leading-relaxed mt-4 max-w-xl">
              Unos 14 millones de precios de supermercado por día, sucursal por sucursal, ordenados para que decidas en
              segundos.
            </p>
            <form
              onSubmit={buscar}
              className="mt-6 flex items-center gap-2 bg-white rounded-2xl p-1.5 pl-4 shadow-flotante max-w-xl"
            >
              <span aria-hidden="true" className="text-lg">
                🔍
              </span>
              <input
                type="search"
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
                placeholder="Buscá un producto: yerba playadito, aceite natura…"
                aria-label="Buscar un producto"
                className="flex-1 min-w-0 bg-transparent text-tinta text-base py-2 placeholder:text-tinta-suave focus:outline-none"
              />
              <button type="submit" className="shrink-0 fondo-marca text-white text-sm font-bold rounded-xl px-4 py-2.5">
                Buscar
              </button>
            </form>
          </div>
          {datos.ejemplo && <TarjetaEjemplo producto={datos.ejemplo} />}
        </div>
      </div>

      {cifras.length > 0 && (
        <dl className="relative -mt-16 sm:-mt-20 grid sm:grid-cols-3 gap-3 sm:gap-4">
          {cifras.map((c) => (
            <div key={c.etiqueta} className="tarjeta shadow-flotante p-5 min-w-0">
              <dt className="text-sm font-semibold text-tinta-suave">{c.etiqueta}</dt>
              <dd className="font-display text-3xl sm:text-4xl text-tinta mt-1.5 leading-tight truncate">{c.valor}</dd>
              <dd className="text-sm text-tinta-media mt-0.5">{c.detalle}</dd>
              <dd className={`inline-block mt-3 text-xs font-bold rounded-full px-2.5 py-1 ${c.chipClase}`}>{c.chip}</dd>
            </div>
          ))}
        </dl>
      )}

      <nav aria-labelledby="titulo-herramientas" className="mt-10">
        <h2 id="titulo-herramientas" className="font-display text-2xl text-tinta mb-4">
          ¿Qué querés saber?
        </h2>
        <ul className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {secciones.map((s) => (
            <li key={s.ruta}>
              <Link
                to={s.ruta}
                className="group tarjeta h-full p-4 sm:p-5 flex flex-col hover:-translate-y-0.5 hover:shadow-flotante transition"
              >
                <span aria-hidden="true" className={`w-12 h-12 rounded-2xl grid place-items-center text-2xl ${s.fondo}`}>
                  {s.icono}
                </span>
                <span className="font-display text-lg sm:text-xl text-tinta mt-3 group-hover:text-marca transition-colors">
                  {s.titulo}
                </span>
                <span className="text-sm text-tinta-media leading-snug mt-1">{s.pregunta}</span>
                {/* El micrografico con los datos reales de la seccion. Tu canasta
                    no tiene: se arma con lo que carga cada visitante. */}
                <span className="hidden sm:block mt-auto pt-4">{s.grafico}</span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </section>
  );
}

export default Presentacion;
