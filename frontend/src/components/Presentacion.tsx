import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Link, useNavigate } from "react-router";
import {
  buscarLocalidades,
  buscarProductos,
  cotizarCanastaPorCadena,
  obtenerComposicionCanasta,
  obtenerInflacionResumen,
  obtenerProducto,
  obtenerQuienGana,
  obtenerQuienGanaZona,
} from "../api/client";
import { fechaEnPalabras, formatearPesos, tamanoQueFalta } from "../utils/formato";
import { cifrasDePortada } from "../utils/cifrasPortada";
import { useZona } from "../contexto/zona";
import { ejemploDePortada } from "../utils/ejemploPortada";
import { cadenasVisibles, localidadDeZona, zonaAParametro, type Zona } from "../utils/zona";
import { nombreLegible } from "../utils/texto";
import AvisoCadenasDeOtroDia from "./AvisoCadenasDeOtroDia";
import TarjetaTuLista from "./TarjetaTuLista";
import type { CanastaPorCadena, InflacionResumen, ProductoDetalle, QuienGana } from "../types";

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

  SIN "QUE QUERES SABER" (2026-11-23). Las cuatro tarjetas de secciones con su
  micrografico se fueron: repetian la barra de navegacion, sus descripciones
  habian quedado viejas y, con las promos del dia arriba, quedaban partidas en
  dos por la vidriera. La portada es buscador, cifras y promos.

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
  ejemplo?: ProductoDetalle;
  canastaPorCadena?: CanastaPorCadena;
};

/** Lo de la portada que depende de la zona (openspec portada-de-tu-zona). La
 *  clave es la zona para la que se pidio: lo que llega tarde de una zona
 *  anterior no se muestra. */
type DatosZona = {
  clave: string;
  quienGana?: QuienGana[];
  /** "zona": cotizada en las sucursales de la zona; "pais": la zona no tiene
   *  precios para la canasta y se usa la del pais. */
  canasta?: { alcance: "zona" | "pais"; datos?: CanastaPorCadena };
};

function TarjetaEjemplo({ producto, zona }: { producto: ProductoDetalle; zona: Zona | null }) {
  // Con zona, las cadenas cerca; si no alcanzan, las del país y lo dice
  // (arreglos-segundo-explore, utils/ejemploPortada).
  const ejemplo = ejemploDePortada(producto.precios, zona ? cadenasVisibles(zona) : null);
  if (!ejemplo) return null;
  const { filas } = ejemplo;
  const pct = ejemplo.deZona ? ejemplo.diferenciaPct : producto.diferencia_pct;
  const alcance = ejemplo.deZona ? " cerca tuyo" : "";
  const nacionalConZona = zona && !ejemplo.deZona ? " · en todo el país" : "";
  const maximo = filas[filas.length - 1].precio_mediano;
  const tamano = tamanoQueFalta(producto.descripcion, producto.cantidad_normalizada, producto.unidad_normalizada);
  const nombre = nombreLegible(producto.descripcion, producto.marca) + (tamano ? ` (${tamano})` : "");
  return (
    <Link
      to={`/mismo-producto?p=${encodeURIComponent(producto.id_producto)}`}
      className="block rounded-[1.75rem] bg-white/12 border border-white/25 backdrop-blur-md p-5 sm:p-6 text-white hover:bg-white/16 transition-colors"
    >
      <p className="text-sm font-semibold text-white/85 line-clamp-1">{nombre}</p>
      <p className="font-display text-5xl sm:text-6xl leading-none mt-2">+{Math.round(pct)}%</p>
      <p className="text-sm font-semibold text-white/85 mt-1">
        según dónde la compres{alcance} · {ejemplo.deZona ? ejemplo.cadenas : producto.cadenas} cadenas{nacionalConZona}
      </p>
      <ul className="mt-4 space-y-3">
        {filas.map((p) => (
          <li key={p.cadena}>
            <span className="flex justify-between gap-3 text-sm font-semibold">
              <span className="truncate">{p.cadena}</span>
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

/** La canasta basica del INDEC (un adulto, gama economica), lista para cotizar. */
function itemsCanastaBasica() {
  return obtenerComposicionCanasta().then((grupos) =>
    grupos.flatMap((g) => g.items.map((i) => ({ ...i, gama: "economico" as const, razon: "" })))
  );
}

/*
  enMedio: las promos del dia (o el mapa), justo despues de las cifras.
  despues: el resto de las promos (filas por categoria y por super). En el
  celular la vidriera quedaba unas tres pantallas mas abajo, detras del ejemplo,
  las cifras apiladas y las cuatro secciones (promos-arriba-en-la-portada).
*/
function Presentacion({ enMedio, despues }: { enMedio?: ReactNode; despues?: ReactNode }) {
  const { zona } = useZona();
  const [datos, setDatos] = useState<Datos>({});
  const [datosZona, setDatosZona] = useState<DatosZona | null>(null);
  const claveZona = zona ? zonaAParametro(zona) : "";
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
    // La canasta basica del INDEC (un adulto, gama economica) en cada cadena.
    // La composicion es una seed que se lee con list_rows y la cotizacion sale
    // del indice en memoria de Tu canasta: ninguna de las dos consume cuota.
    itemsCanastaBasica()
      .then((items) => cotizarCanastaPorCadena(items, []))
      .then((canastaPorCadena) => {
        if (!cancelado) setDatos((previo) => ({ ...previo, canastaPorCadena }));
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

  // Con zona: quien gana entre las cadenas de la zona y la canasta en sus
  // sucursales. Las dos salen de indices en memoria (Mas barato y Tu canasta
  // hacen los mismos pedidos), y se vuelven a pedir si cambia la zona.
  useEffect(() => {
    if (!zona) return;
    let cancelado = false;
    const guardar = (parte: Partial<DatosZona>) => {
      if (!cancelado) setDatosZona((previo) => ({ ...(previo?.clave === claveZona ? previo : { clave: claveZona }), ...parte }));
    };
    obtenerQuienGanaZona(zona.cadenas)
      .then((quienGana) => guardar({ quienGana }))
      .catch(() => guardar({ quienGana: [] }));
    Promise.all([buscarLocalidades(zona.nombre), itemsCanastaBasica()])
      .then(([opciones, items]) => {
        const localidad = localidadDeZona(opciones, zona);
        if (!localidad) return guardar({ canasta: { alcance: "pais" } });
        // La API cotiza el pais cuando la zona no alcanza para comparar (por
        // ejemplo, una sola cadena): el alcance lo dice la respuesta.
        return cotizarCanastaPorCadena(items, [localidad]).then((datos) =>
          guardar({ canasta: { alcance: datos.ambito === "zona" ? "zona" : "pais", datos } })
        );
      })
      .catch(() => guardar({ canasta: { alcance: "pais" } }));
    return () => {
      cancelado = true;
    };
  }, [zona, claveZona]);

  const inflacion = datos.inflacion ?? [];

  const fechaDatos = fechaEnPalabras(datos.ejemplo?.fecha_datos ?? datos.inflacion?.[0]?.fecha_fin ?? "");

  // Las tarjetas (utils/cifrasPortada). Con zona, mientras llega lo de la zona
  // no se muestra la cifra del pais en su lugar: pasaria de "Maxi" a la cadena
  // de la zona delante de los ojos.
  const zonaVigente = zona && datosZona?.clave === claveZona ? datosZona : null;
  const canastaZona = zonaVigente?.canasta;
  const cifras = cifrasDePortada(
    {
      inflacion,
      quienGana: zona ? zonaVigente?.quienGana : datos.quienGana,
      canasta: !zona ? datos.canastaPorCadena : canastaZona ? (canastaZona.datos ?? datos.canastaPorCadena) : undefined,
      canastaDeZona: canastaZona?.alcance === "zona",
    },
    zona ? zona.cadenas : null,
    zona?.otra_cadena_cerca
  );

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
            {/* En el celular se esconde: deja lugar para que las promos del dia asomen en la primera pantalla. */}
            <p className="hidden sm:block text-lg text-white/85 leading-relaxed mt-4 max-w-xl">
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
            {/* Si hay lista guardada, la portada arranca por ahi (lista-en-el-centro). */}
            <TarjetaTuLista />
          </div>
          {/* En el celular el ejemplo baja debajo de las promos: arriba ocupaba media pantalla. */}
          {datos.ejemplo && (
            <div className="hidden lg:block">
              <TarjetaEjemplo producto={datos.ejemplo} zona={zona} />
            </div>
          )}
        </div>
      </div>

      {cifras.length > 0 && (
        /* En el celular las tres cifras se deslizan de costado: apiladas ocupaban casi una pantalla. */
        /* La key la vuelve a montar cuando cambian las cifras (llegan de a una): si no, el navegador se queda
           enganchado en la tarjeta que tenia a la vista y la fila arranca corrida. */
        <dl key={cifras.map((c) => c.etiqueta).join("|")} className="relative -mt-16 sm:-mt-20 flex gap-3 overflow-x-auto snap-x snap-mandatory pb-3 -mx-1 px-1 sm:grid sm:grid-cols-3 sm:gap-4 sm:overflow-visible sm:mx-0 sm:px-0 sm:pb-0">
          {cifras.map((c) => (
            <div key={c.etiqueta} className="@container tarjeta shadow-flotante p-5 min-w-0 w-[82%] shrink-0 snap-start sm:w-auto">
              <dt className="text-sm font-semibold text-tinta-suave">{c.etiqueta}</dt>
              {/* La letra sigue el ancho de la tarjeta (cqi) y no el de la
                  pantalla: con tres tarjetas en ~800 px, "Maxi (Carrefour)" se
                  cortaba en "Maxi (Carrefo…". Si un nombre igual no entra, baja
                  de renglon en vez de cortarse. */}
              <dd className="font-display text-[clamp(1.125rem,9.5cqi,2.25rem)] text-tinta mt-1.5 leading-tight text-balance break-words">
                {c.valor}
              </dd>
              <dd className="text-sm text-tinta-media mt-0.5">{c.detalle}</dd>
              <dd className={`inline-block mt-3 text-xs font-bold rounded-full px-2.5 py-1 ${c.chipClase}`}>{c.chip}</dd>
            </div>
          ))}
        </dl>
      )}
      {/* Con zona, cada tarjeta dice si su dato es de la zona o del pais
          (spec portada); la linea "Estas cifras son de todo el pais" se fue. */}
      {/* Las cifras de arriba usan los precios de Mismo producto y Mas barato. */}
      <AvisoCadenasDeOtroDia className="mt-4" />

      {enMedio && <div className="mt-10">{enMedio}</div>}
      {despues}

      {/* En el celular el ejemplo va al final, despues de todas las promos. */}
      {datos.ejemplo && (
        <div className="lg:hidden mt-10 fondo-marca rounded-[2rem] p-1">
          <TarjetaEjemplo producto={datos.ejemplo} zona={zona} />
        </div>
      )}
    </section>
  );
}

export default Presentacion;
