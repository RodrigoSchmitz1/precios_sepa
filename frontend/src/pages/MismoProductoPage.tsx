import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { buscarProductos, obtenerProducto, obtenerProductosDestacados } from "../api/client";
import Titular, { Resaltado } from "../components/Titular";
import FilaDeCifras from "../components/FilaDeCifras";
import TiraDePuntos from "../components/TiraDePuntos";
import TuLista from "../components/TuLista";
import CuantoConvieneComparar from "../components/CuantoConvieneComparar";
import DeTuCanasta from "../components/DeTuCanasta";
import { leerDelNavegador } from "../utils/canastaGuardada";
import { fechaEnPalabras, formatearNumero, formatearPesos, tamanoQueFalta } from "../utils/formato";
import { listarConY, nombreLegible } from "../utils/texto";
import { useZona } from "../contexto/zona";
import { partirPorZona } from "../utils/precioEnZona";
import { titularDelProducto, type TitularProducto } from "../utils/titularProducto";
import { cadenasVisibles, rotuloZona, type Zona } from "../utils/zona";
import { useLista } from "../contexto/lista";
import { etiquetaFechaPrecio } from "../utils/cadenasDeOtroDia";
import AvisoCadenasDeOtroDia from "../components/AvisoCadenasDeOtroDia";
import type { PrecioEnCadena, ProductoComparado, ProductoDetalle } from "../types";
import PromosCercaDelProducto from "../components/PromosCercaDelProducto";
import BotonCompartir from "../components/BotonCompartir";
import { textoParaCompartir } from "../utils/compartir";
import { claseCambio, textoCambioDetalle } from "../utils/cambioPrecio";

/*
  El mismo producto: cuanto cuesta el mismo codigo de barras en cada cadena.

  Es la comparacion mas directa que permiten los datos: mismo producto, misma
  presentacion, y la unica diferencia es donde se compra. No hace falta
  normalizar por kilo ni elegir una canasta, asi que el numero se entiende sin
  leer la metodologia.

  El producto elegido va en la URL (?p=codigo) para que se pueda compartir.
*/

// Igual que SUCURSALES_MINIMAS_EXTREMO en api/mismo_producto.py: debajo de esto
// la mediana de la cadena puede ser un precio mal cargado en una sola sucursal.
/*
  Los dos productos que se muestran desplegados al entrar. Van por BUSQUEDA y no
  por codigo de barras: el id de un producto puede dejar de estar en el mart
  cualquier dia (si esa fecha no lo informa una segunda cadena, sale), y un
  ejemplo fijo que desaparece deja la portada vacia. Buscando, si cambia el
  envase o el codigo, sigue apareciendo el producto equivalente.

  Se eligen conocidos y no los de mayor diferencia: la portada tiene que
  mostrar como se ve la comparacion, y para eso sirve mas algo que el visitante
  compra que el producto mas disparatado del dia.
*/
/** Nombre legible con el tamano del envase entre parentesis, si la
 *  descripcion no lo dice ya. */
function nombreConTamano(p: ProductoComparado): string {
  const tamano = tamanoQueFalta(p.descripcion, p.cantidad_normalizada, p.unidad_normalizada);
  const legible = nombreLegible(p.descripcion, p.marca);
  return tamano ? `${legible} (${tamano})` : legible;
}

const EJEMPLOS = ["coca cola 2.25", "taragui 1kg"];

const SUCURSALES_MINIMAS = 3;
// Igual que EMPRESAS_MINIMAS_DESTACADO en api/mismo_producto.py.
const EMPRESAS_MINIMAS = 3;

type Busqueda = { consulta: string; productos?: ProductoComparado[]; error?: string };
type Detalle = { id: string; producto?: ProductoDetalle; error?: string };
type Destacados = { productos?: ProductoComparado[]; error?: string };

function porcentaje(valor: number): string {
  return `${Math.round(valor).toLocaleString("es-AR")}%`;
}

/** "Coto" o "Coto y 2 mas" cuando varias cadenas empatan en el extremo. */
function nombrarCadenas(lista: PrecioEnCadena[]): string {
  return lista.length === 1 ? lista[0].cadena : `${lista[0].cadena} y ${lista.length - 1} más`;
}

function textoSucursales(n: number): string {
  return `${formatearNumero(n)} ${n === 1 ? "sucursal" : "sucursales"}`;
}

/** "Coto", "Coto y Dia", "Coto, Dia y Vea". */
function listar(nombres: string[]): string {
  return nombres.length === 1 ? nombres[0] : `${nombres.slice(0, -1).join(", ")} y ${nombres[nombres.length - 1]}`;
}

/*
  Por que un precio queda fuera de la comparacion, con los numeros.

  Hasta el 2026-09-23 la fila decia "sin verificar" y el precio iba tachado.
  Ninguna de las dos cosas se entendia: "sin verificar" no dice contra que, y el
  tachado en este sitio es el precio de lista de una promo. Ademas no es un
  juicio sobre la cadena: puede ser una oferta real que nadie mas tiene.
*/
function explicarDescartes(p: ProductoDetalle): string | null {
  const fuera = p.precios.filter((x) => !x.precio_creible);
  if (fuera.length === 0) return null;
  const porPrecio = new Map<number, string[]>();
  for (const x of fuera) porPrecio.set(x.precio_mediano, [...(porPrecio.get(x.precio_mediano) ?? []), x.cadena]);
  const ref = p.precio_referencia;
  const partes = [...porPrecio].map(([precio, cadenas]) => {
    const quien = `${listar(cadenas)} ${cadenas.length > 1 ? "informan" : "informa"} ${formatearPesos(precio)}`;
    if (!ref) return quien;
    return `${quien}, ${precio < ref ? "menos de la mitad" : "más del doble"} de lo que cobran las demás (${formatearPesos(ref)} en la mediana)`;
  });
  const varios = porPrecio.size > 1;
  return (
    `${partes.join("; ")}. Ninguna otra cadena ${varios ? "confirma esos precios" : "confirma ese precio"}: ` +
    `puede ser una oferta o un error de carga, así que ${varios ? "se muestran" : "se muestra"} pero no ${varios ? "entran" : "entra"} en la diferencia.`
  );
}

/*
  Los puntos de la tira: solo los precios que entran en la comparacion. Con
  todos, la tira marcaba como extremo un precio que las cifras de al lado
  ignoraban (Changomas a $1.590 junto a "mas barato: $1.695"), y un error como
  Fanta a $309 contra $5.150 aplastaba a las demas cadenas contra un borde. Los
  descartados siguen en la lista, con su explicacion.
*/
/** Con zona, solo las cadenas de la zona: la tira es parte de la respuesta. */
function puntosComparables(p: ProductoDetalle, cadenasZona: Set<string> | null = null) {
  return p.precios
    .filter((x) => x.precio_creible && (!cadenasZona || cadenasZona.has(x.cadena)))
    .map((x) => ({ id: x.cadena, valor: x.precio_mediano, nombre: x.cadena }));
}

function Aviso({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-sm text-alerta bg-alerta-tenue border border-alerta/20 rounded-lg px-3 py-2">{children}</p>
  );
}

/*
  Un ejemplo de la portada: el nombre del producto, la visual con los precios de
  cada cadena y el despliegue por super. Sin Titular a proposito: VistaProducto
  lo incluye, y dos de esas en la portada repetian la banda oscura tres veces en
  la misma pantalla.
*/
function EjemploComparacion({ p, onVer }: { p: ProductoDetalle; onVer: (id: string) => void }) {
  const nombre = nombreConTamano(p);
  const baratos = p.precios.filter((x) => x.precio_mediano === p.precio_mas_bajo);
  const caros = p.precios.filter((x) => x.precio_mediano === p.precio_mas_alto);
  const hayDiferencia = p.precio_mas_alto > p.precio_mas_bajo;

  return (
    <article className="mb-8">
      <button onClick={() => onVer(p.id_producto)} className="group text-left mb-1">
        <h3 className="font-display text-2xl text-tinta group-hover:text-marca transition-colors">{nombre}</h3>
      </button>
      <p className="text-sm text-tinta-media mb-4">
        {hayDiferencia ? (
          <>
            <span className="text-alerta font-medium">{porcentaje(p.diferencia_pct)} más caro</span> en{" "}
            {nombrarCadenas(caros)} que en {nombrarCadenas(baratos)} · {p.cadenas} cadenas
          </>
        ) : (
          <>El mismo precio en las {p.cadenas} cadenas</>
        )}
      </p>

      {hayDiferencia && (
        <div className="mb-4">
          <TiraDePuntos
            puntos={puntosComparables(p)}
            formatear={formatearPesos}
            descripcion={`Precio de ${nombre} en cada cadena, de ${formatearPesos(p.precio_mas_bajo)} a ${formatearPesos(p.precio_mas_alto)}`}
          />
        </div>
      )}

      <ListaDePrecios p={p} />
    </article>
  );
}

/** Las filas de precios de un grupo de cadenas. */
export function FilasDePrecios({ precios, fechaDatos }: { precios: PrecioEnCadena[]; fechaDatos?: string }) {
  return (
      <ul className="tarjeta divide-y divide-linea">
      {precios.map((x) => (
        <li
          key={x.cadena}
          className={`flex items-baseline gap-3 sm:gap-4 px-4 py-2.5 ${x.precio_creible ? "" : "bg-papel-hundido"}`}
        >
          <span className="flex-1 min-w-0">
            <span className="block text-base text-tinta truncate">{x.cadena}</span>
            {/*
              Segunda linea: por que esta atenuado y, en el celular, las
              sucursales. Un renglon en gris sin explicacion parece un error del
              sitio; con el motivo es informacion (el detalle con los numeros va
              debajo de la lista). En 375 px, con las sucursales como columna,
              "HiperChangomas" y "Market (Carrefour)" quedaban recortados.
            */}
            <span className="block text-xs">
              <span className={`sm:hidden ${x.sucursales < SUCURSALES_MINIMAS ? "text-aviso" : "text-tinta-suave"}`}>
                {textoSucursales(x.sucursales)}
              </span>
              {!x.precio_creible && (
                <span className="text-aviso">
                  <span className="sm:hidden"> · </span>fuera de la comparación
                </span>
              )}
              {/* SEPA no publico esta cadena en el ultimo dia: el precio es el
                  mas reciente que tiene (ver AvisoCadenasDeOtroDia). */}
              {etiquetaFechaPrecio(x.fecha_precio, fechaDatos) && (
                <span className="text-aviso">
                  <span className={x.precio_creible ? "sm:hidden" : ""}> · </span>
                  {etiquetaFechaPrecio(x.fecha_precio, fechaDatos)}
                </span>
              )}
            </span>
            {/* El ultimo cambio de precio de esta cadena, si es reciente y de
                3% o mas (historia-de-precio). Sin cambio no se dice nada. */}
            {x.cambio && (
              <span className={`block text-xs ${claseCambio(x.cambio)}`}>{textoCambioDetalle(x.cambio)}</span>
            )}
          </span>
          {x.precio_maximo > x.precio_minimo && (
            <span className="numero text-xs text-tinta-suave hidden sm:inline" title="Rango entre sucursales">
              {formatearPesos(x.precio_minimo)} a {formatearPesos(x.precio_maximo)}
            </span>
          )}
          <span
            className={`text-xs shrink-0 hidden sm:inline ${x.sucursales < SUCURSALES_MINIMAS ? "text-aviso" : "text-tinta-suave"}`}
          >
            {textoSucursales(x.sucursales)}
          </span>
          <span
            className={`numero text-sm w-20 sm:w-24 text-right shrink-0 ${
              x.precio_creible ? "font-semibold text-tinta" : "text-tinta-suave"
            }`}
          >
            {formatearPesos(x.precio_mediano)}
          </span>
        </li>
      ))}
      </ul>
  );
}

/** La lista de precios por cadena. Se extrae de VistaProducto para poder
 *  mostrarla tambien en los ejemplos de la portada, donde no va el titular.
 *  Con zona, las cadenas de la zona van primero y aparte (2026-11). */
function ListaDePrecios({ p, zona }: { p: ProductoDetalle; zona?: Zona | null }) {
  const descartes = explicarDescartes(p);
  const { enZona, resto } = zona ? partirPorZona(p.precios, cadenasVisibles(zona)) : { enZona: [], resto: p.precios };
  return (
    <>
      {zona && enZona.length > 0 && (
        <>
          <h3 className="text-sm font-bold text-tinta mb-2">En tu zona · {zona.nombre}</h3>
          <FilasDePrecios precios={enZona} fechaDatos={p.fecha_datos} />
          {resto.length > 0 && <h3 className="text-sm font-bold text-tinta mt-5 mb-2">Otras cadenas del país</h3>}
        </>
      )}
      {resto.length > 0 && <FilasDePrecios precios={resto} fechaDatos={p.fecha_datos} />}
      {/* Fija, con o sin zona: no hay precio por sucursal de un producto exacto. */}
      <p className="text-xs text-tinta-suave mt-2 leading-relaxed">
        Cada precio es el de la cadena en todo el país: la mediana entre sus sucursales.
      </p>
      {descartes && <p className="text-xs text-tinta-media mt-2 leading-relaxed">{descartes}</p>}
    </>
  );
}

/** El titular del producto: de la zona si hay zona, y "casi lo mismo" si la
 *  diferencia es chica (ver utils/titularProducto). */
function TextoTitular({ p, t, nombre }: { p: ProductoDetalle; t: TitularProducto; nombre: string }) {
  const c = t.cifras;
  const pesos = (n: number) => <span className="numero">{formatearPesos(n)}</span>;
  if (t.alcance === "zona") {
    switch (t.tipo) {
      case "no_en_zona":
        return <>{nombre}: en tu zona no se consigue</>;
      case "sin_creible_en_zona":
        return <>{nombre}: en tu zona el precio puede estar mal cargado</>;
      case "una_cadena":
        return <>En tu zona solo lo vende {t.cadena}, a {pesos(t.precio)}</>;
      case "igual":
        return <>En tu zona sale {pesos(c.precio)} en todas las cadenas</>;
      case "casi_igual":
        return (
          <>
            En tu zona cuesta casi lo mismo: de {pesos(c.precio)} en {listarConY(c.baratas)} a {pesos(c.precioCaro)} en{" "}
            {listarConY(c.caras)}
          </>
        );
      case "diferencia":
        return (
          <>
            En tu zona, {listarConY(c.baratas)} lo tiene a {pesos(c.precio)}:{" "}
            <Resaltado tono="barato">un {c.menosPct}% menos</Resaltado> que {listarConY(c.caras)}
          </>
        );
    }
  }
  switch (t.tipo) {
    case "igual":
      return <>{nombre}: el mismo precio en las {p.cadenas} cadenas</>;
    case "casi_igual":
      return (
        <>
          {nombre}: cuesta casi lo mismo en las {p.cadenas} cadenas ({pesos(c.precioCaro - c.precio)} de diferencia)
        </>
      );
    case "sin_respaldo":
      return (
        <>
          {nombre}: de {pesos(c.precio)} a {pesos(c.precioCaro)} según la cadena
        </>
      );
    default:
      return (
        <>
          {nombre}: <Resaltado>{porcentaje(c.diferenciaPct)} más caro</Resaltado> en {nombrarLista(c.caras)} que en{" "}
          {nombrarLista(c.baratas)}
        </>
      );
  }
}

/** "Coto" o "Coto y 2 más", como nombrarCadenas pero desde nombres. */
function nombrarLista(nombres: string[]): string {
  return nombres.length === 1 ? nombres[0] : `${nombres[0]} y ${nombres.length - 1} más`;
}

/** Agregar un producto a Tu lista, o avisar que ya esta. */
function BotonLista({ enLista, onAgregar, compacto = false }: { enLista: boolean; onAgregar: () => void; compacto?: boolean }) {
  if (enLista) {
    return (
      <span className={`shrink-0 text-marca ${compacto ? "text-xs px-2" : "text-sm"}`} aria-label="Está en tu lista">
        ✓ {compacto ? "En la lista" : "Está en tu lista"}
      </span>
    );
  }
  return (
    <button
      onClick={onAgregar}
      className={`shrink-0 rounded-full border border-marca-borde text-marca hover:bg-marca-tenue transition-colors ${
        compacto ? "text-xs px-2.5 py-1" : "text-sm px-4 py-2 font-medium"
      }`}
    >
      + {compacto ? "Lista" : "Agregar a tu lista"}
    </button>
  );
}

/** Sin canasta ni lista: los dos caminos para armar la compra. */
function DosCaminos() {
  return (
    <section aria-labelledby="titulo-dos-caminos" className="mb-10">
      <h2 id="titulo-dos-caminos" className="font-display text-2xl text-tinta mb-1">
        ¿Dónde te conviene hacer la compra?
      </h2>
      <p className="text-sm text-tinta-media mb-4">
        Con tus productos exactos te decimos en qué cadena te sale más barata la compra entera y cuánto ahorrás.
      </p>
      <div className="grid sm:grid-cols-2 gap-3">
        <Link
          to="/canasta-personalizada"
          className="group block rounded-2xl border border-marca-borde bg-marca-tenue/40 p-4 sm:p-5 hover:bg-marca-tenue transition-colors"
        >
          <span className="inline-block text-xs font-bold text-marca bg-white rounded-full px-2.5 py-1 mb-2">La compra del mes</span>
          <span className="block font-display text-xl text-tinta mb-1">Armá tu canasta</span>
          <span className="block text-sm text-tinta-media leading-relaxed">
            Contanos qué compran en tu casa y la armamos con vos. Después volvé acá y elegí la marca de cada cosa con
            un toque.
          </span>
          <span className="inline-block mt-3 text-sm font-medium text-marca group-hover:translate-x-0.5 transition-transform">
            Ir a Tu canasta →
          </span>
        </Link>
        <div className="rounded-2xl border border-linea bg-papel p-4 sm:p-5">
          <span className="block text-base font-bold text-tinta mb-2">Algunos productos</span>
          <span className="block font-display text-xl text-tinta mb-1">Armá tu lista</span>
          <span className="block text-sm text-tinta-media leading-relaxed">
            Buscá arriba lo que comprás siempre -tu yerba, tu aceite, tu café- y sumalo con{" "}
            <span className="text-marca font-medium">+ Lista</span>.
          </span>
        </div>
      </div>
    </section>
  );
}

function VistaProducto({
  estado,
  onVolver,
  enLista,
  onAgregar,
}: {
  estado: Detalle | null;
  onVolver?: () => void;
  enLista?: (id: string) => boolean;
  onAgregar?: (p: ProductoComparado) => void;
}) {
  // La zona solo en la vista de un producto elegido, no en los ejemplos de la
  // portada de la seccion (sin onVolver), que siguen siendo nacionales.
  const { zona: zonaElegida } = useZona();
  const zona = onVolver ? zonaElegida : null;
  // El titular ya pintado: es el texto que se comparte (compartir-por-whatsapp).
  const refTitular = useRef<HTMLSpanElement>(null);
  if (estado === null) return <p className="text-sm text-tinta-suave mb-10">Cargando…</p>;

  // Sin onVolver la vista se usa como ejemplo dentro de la portada de la
  // seccion, donde no hay de donde volver.
  const volver = onVolver ? (
    <button onClick={onVolver} className="text-sm text-tinta-media hover:text-tinta mb-4">
      ← Todos los productos
    </button>
  ) : null;

  if (estado.error || !estado.producto) {
    return (
      <div className="mb-10">
        {volver}
        <Aviso>{estado.error ?? "No se encontró el producto."}</Aviso>
      </div>
    );
  }

  const p = estado.producto;
  const nombre = nombreConTamano(p);
  const t = titularDelProducto(p, zona ? cadenasVisibles(zona) : null);
  const c = t.cifras;
  const hayDiferencia = p.precio_mas_alto > p.precio_mas_bajo;
  const deZona = t.alcance === "zona" && t.tipo !== "no_en_zona" && t.tipo !== "sin_creible_en_zona";
  const sufijo = deZona ? " en tu zona" : "";

  return (
    <section className="mb-12">
      {/* Siempre compacto: el producto elegido es el resultado (2026-11). */}
      <Titular antetitulo={deZona ? `${nombre} · ${rotuloZona(zona!)}` : "El mismo producto"} compacto>
        <span ref={refTitular}>
          <TextoTitular p={p} t={t} nombre={nombre} />
        </span>
      </Titular>
      {/* Debajo de la banda y no arriba: la banda sube 40 px (-mt-10) y tapaba
          el boton, que quedaba invisible e intocable en el celular. */}
      {volver}
      <AvisoCadenasDeOtroDia className="mb-6" />

      {(deZona ? c.precioCaro > c.precio : hayDiferencia) && (
        <div className="mb-6">
          <TiraDePuntos
            puntos={puntosComparables(p, deZona ? cadenasVisibles(zona!) : null)}
            formatear={formatearPesos}
            descripcion={`Precio de ${nombre} en cada cadena${sufijo}, de ${formatearPesos(c.precio)} a ${formatearPesos(c.precioCaro)}`}
          />
        </div>
      )}

      {onAgregar && enLista && (
        <div className="mb-6 flex flex-wrap items-center gap-3">
          <BotonLista enLista={enLista(p.id_producto)} onAgregar={() => onAgregar(p)} />
          {/* Solo en el producto elegido: la URL ya lleva el producto y la zona. */}
          {onVolver && (
            <BotonCompartir
              datos={() => ({
                titulo: `${nombre} · Changuito`,
                texto: textoParaCompartir(nombre, refTitular.current?.textContent ?? "", zona ? rotuloZona(zona) : null),
                url: window.location.href,
              })}
            />
          )}
          <span className="text-xs text-tinta-suave">Sumalo con lo que comprás siempre y mirá dónde te conviene la compra entera.</span>
        </div>
      )}

      {zona && (
        <PromosCercaDelProducto
          idProducto={p.id_producto}
          zona={zona}
          // Sin cadenas de la zona que lo vendan no hay precio con que comparar.
          precioZona={deZona ? c.precio : undefined}
        />
      )}

      <div className="mb-3">
        <FilaDeCifras
          cifras={
            t.tipo === "una_cadena"
              ? [
                  { etiqueta: "Precio en tu zona", valor: formatearPesos(t.precio), detalle: t.cadena },
                  { etiqueta: "Cadenas", valor: formatearNumero(p.cadenas), detalle: "lo venden en el país" },
                ]
              : [
                  { etiqueta: `Más barato${sufijo}`, valor: formatearPesos(c.precio), detalle: nombrarLista(c.baratas) },
                  { etiqueta: `Más caro${sufijo}`, valor: formatearPesos(c.precioCaro), detalle: nombrarLista(c.caras) },
                  { etiqueta: `Diferencia${sufijo}`, valor: formatearPesos(c.precioCaro - c.precio), detalle: "por el mismo producto" },
                  deZona
                    ? { etiqueta: "Cadenas en tu zona", valor: formatearNumero(c.cadenas), detalle: `de ${formatearNumero(p.cadenas)} en el país` }
                    : { etiqueta: "Cadenas", valor: formatearNumero(p.cadenas), detalle: "con este código de barras" },
                ]
          }
        />
      </div>
      {/* Lo que antes iba en la bajada del titular. */}
      <div className="mb-6 text-xs text-tinta-suave leading-relaxed space-y-1">
        {deZona && hayDiferencia && (
          <p>
            En todo el país, de {formatearPesos(p.precio_mas_bajo)} en {nombrarCadenas(p.precios.filter((x) => x.precio_mediano === p.precio_mas_bajo))} a{" "}
            {formatearPesos(p.precio_mas_alto)} en {nombrarCadenas(p.precios.filter((x) => x.precio_mediano === p.precio_mas_alto))}.
          </p>
        )}
        <p>
          Mismo código de barras ({p.id_producto}) en {p.cadenas} cadenas, con precios del {fechaEnPalabras(p.fecha_datos)}. El
          precio de cada cadena es la mediana entre sus sucursales.
        </p>
        {hayDiferencia && !p.extremos_respaldados && (
          <p className="text-aviso">
            El precio más bajo o el más alto sale de menos de {SUCURSALES_MINIMAS} sucursales: la diferencia puede deberse a
            un precio mal cargado.
          </p>
        )}
      </div>

      <ListaDePrecios p={p} zona={zona} />
    </section>
  );
}

function FilaProducto({
  producto,
  onElegir,
  enLista,
  onAgregar,
}: {
  producto: ProductoComparado;
  onElegir: (id: string) => void;
  enLista: boolean;
  onAgregar: (p: ProductoComparado) => void;
}) {
  const hayDiferencia = producto.precio_mas_alto > producto.precio_mas_bajo;
  return (
    <li className="flex items-center gap-2 pr-3 hover:bg-papel-hundido transition-colors">
      <button
        onClick={() => onElegir(producto.id_producto)}
        className="flex-1 min-w-0 flex items-baseline gap-4 pl-4 py-3 text-left"
      >
        <span className="flex-1 min-w-0">
          <span className="block text-sm text-tinta truncate">
            {nombreConTamano(producto)}
          </span>
          <span className="block text-xs text-tinta-suave numero">
            {producto.cadenas} cadenas · {formatearPesos(producto.precio_mas_bajo)}
            {hayDiferencia && ` a ${formatearPesos(producto.precio_mas_alto)}`}
          </span>
        </span>
        <span
          className={`numero text-sm font-semibold shrink-0 ${
            hayDiferencia && producto.extremos_respaldados ? "text-alerta" : "text-tinta-suave"
          }`}
        >
          {hayDiferencia ? `+${porcentaje(producto.diferencia_pct)}` : "igual"}
        </span>
      </button>
      <BotonLista enLista={enLista} onAgregar={() => onAgregar(producto)} compacto />
    </li>
  );
}

function MismoProductoPage() {
  const [params, setParams] = useSearchParams();
  const id = params.get("p");

  const [texto, setTexto] = useState(() => params.get("q") ?? ""); // ?q= llega del buscador de la portada
  const consulta = texto.trim();
  const [busqueda, setBusqueda] = useState<Busqueda | null>(null);
  const [detalle, setDetalle] = useState<Detalle | null>(null);
  const [destacados, setDestacados] = useState<Destacados | null>(null);
  const [ejemplos, setEjemplos] = useState<ProductoDetalle[]>([]);
  // La lista es la de todo el sitio (ProveedorLista, lista-a-mano).
  const { lista, agregar: agregarItem, cambiarCantidad, quitar, vaciar, enLista } = useLista();
  // Tu canasta, si ya la armo en este navegador: sus categorias son las filas
  // de "De tu canasta". Se lee una vez; la canasta se edita en su pagina.
  const [canasta] = useState(() => leerDelNavegador()?.items ?? []);

  const agregar = (p: ProductoComparado, cantidad = 1) =>
    agregarItem({ id_producto: p.id_producto, nombre: nombreConTamano(p), cantidad, categoria: p.categoria });

  useEffect(() => {
    let cancelado = false;
    obtenerProductosDestacados()
      .then((productos) => {
        if (!cancelado) setDestacados({ productos });
      })
      .catch((err) => {
        if (!cancelado) setDestacados({ error: err.message });
      });
    return () => {
      cancelado = true;
    };
  }, []);

  useEffect(() => {
    if (consulta.length < 2) return;
    let cancelado = false;
    const espera = setTimeout(() => {
      buscarProductos(consulta)
        .then((productos) => {
          if (!cancelado) setBusqueda({ consulta, productos });
        })
        .catch((err) => {
          if (!cancelado) setBusqueda({ consulta, error: err.message });
        });
    }, 300);
    return () => {
      cancelado = true;
      clearTimeout(espera);
    };
  }, [consulta]);

  /*
    La portada de la seccion abria con una lista de nombres y un porcentaje. Lo
    que hace interesante a esta pagina -la comparacion del mismo codigo de
    barras entre cadenas- quedaba a un click de distancia y no se descubria: el
    visitante veia productos que no le importaban y se iba antes de buscar el
    suyo.

    Ahora se despliegan dos ejemplos ya armados. No cuesta cuota: los detalles
    salen del mismo indice en memoria que ya se cargo para los destacados.
  */
  useEffect(() => {
    if (id) return;
    let cancelado = false;
    Promise.all(
      EJEMPLOS.map((consulta) =>
        buscarProductos(consulta).then((r) => (r.length > 0 ? obtenerProducto(r[0].id_producto) : null))
      )
    )
      .then((todos) => todos.filter((x): x is ProductoDetalle => x !== null))
      .then((detalles) => {
        if (!cancelado) setEjemplos(detalles);
      })
      .catch(() => {
        // Sin ejemplos la pagina sigue sirviendo: el buscador es lo principal.
      });
    return () => {
      cancelado = true;
    };
  }, [id]);

  useEffect(() => {
    if (!id) return;
    let cancelado = false;
    obtenerProducto(id)
      .then((producto) => {
        if (!cancelado) setDetalle({ id, producto });
      })
      .catch((err) => {
        if (!cancelado) setDetalle({ id, error: err.message });
      });
    return () => {
      cancelado = true;
    };
  }, [id]);

  // Estados de carga derivados, como en el resto de las paginas: lo cargado
  // solo cuenta si corresponde a lo que se esta pidiendo ahora.
  const busquedaVigente = consulta.length >= 2 && busqueda?.consulta === consulta ? busqueda : null;
  const detalleVigente = id && detalle?.id === id ? detalle : null;

  const elegir = (idProducto: string) => {
    setParams({ p: idProducto });
    setTexto("");
    window.scrollTo({ top: 0 });
  };

  const mayor = destacados?.productos?.[0];

  return (
    <div className="max-w-4xl mx-auto">
      {id ? (
        <VistaProducto
          estado={detalleVigente}
          onVolver={() => setParams({})}
          enLista={enLista}
          onAgregar={agregar}
        />
      ) : (
        <>
        <Titular
          antetitulo="El mismo producto"
          compacto={consulta.length >= 2 || lista.length > 0}
          bajada="Mismo código de barras, misma presentación: la única diferencia es dónde lo comprás. Buscá un producto y mirá cuánto cuesta en cada cadena, o armá tu lista con lo que comprás siempre y fijate dónde te conviene la compra entera."
        >
          {mayor ? (
            <>
              El mismo producto puede costar <Resaltado>{porcentaje(mayor.diferencia_pct)} más</Resaltado> según la
              cadena
            </>
          ) : (
            "El mismo producto, otro precio"
          )}
        </Titular>
        <AvisoCadenasDeOtroDia className="mb-6" />
        </>
      )}

      <section className="mb-10" aria-label="Buscar un producto">
        <input
          type="search"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder={id ? "Buscar otro producto" : "Buscar: yerba playadito, aceite natura, coca cola 2,25"}
          aria-label="Buscar un producto"
          autoComplete="off"
          className="w-full bg-papel rounded-2xl shadow-flotante px-5 py-4 text-base focus:outline-none focus:ring-2 focus:ring-marca/40"
        />

        {consulta.length >= 2 && busquedaVigente === null && (
          <p className="mt-3 text-sm text-tinta-suave">Buscando…</p>
        )}
        {busquedaVigente?.error && (
          <div className="mt-3">
            <Aviso>{busquedaVigente.error}</Aviso>
          </div>
        )}
        {busquedaVigente?.productos && busquedaVigente.productos.length === 0 && (
          <p className="mt-3 text-sm text-tinta-suave">
            Ningún producto con esas palabras tiene precio en dos o más cadenas.
          </p>
        )}
        {busquedaVigente?.productos && busquedaVigente.productos.length > 0 && (
          <ul className="mt-3 tarjeta divide-y divide-linea overflow-hidden">
            {busquedaVigente.productos.map((producto) => (
              <FilaProducto
                key={producto.id_producto}
                producto={producto}
                onElegir={elegir}
                enLista={enLista(producto.id_producto)}
                onAgregar={agregar}
              />
            ))}
          </ul>
        )}
      </section>

      {!id && consulta.length < 2 && canasta.length > 0 && (
        <DeTuCanasta items={canasta} lista={lista} onAgregar={agregar} onVer={elegir} nombrar={nombreConTamano} />
      )}

      {lista.length > 0 && (
        <TuLista
          lista={lista}
          onCambiarCantidad={cambiarCantidad}
          onQuitar={quitar}
          onVaciar={vaciar}
          onVer={elegir}
        />
      )}

      {!id && lista.length === 0 && canasta.length === 0 && <DosCaminos />}
      {!id && lista.length > 0 && canasta.length === 0 && (
        <p className="-mt-6 mb-10 text-sm text-tinta-media">
          ¿Es la compra del mes?{" "}
          <Link to="/canasta-personalizada" className="text-marca font-medium hover:text-marca-hover">
            Armá tu canasta
          </Link>{" "}
          y elegí acá la marca de cada cosa.
        </p>
      )}

      {!id && consulta.length < 2 && ejemplos.length > 0 && (
        <section aria-labelledby="titulo-ejemplos" className="mb-12">
          <h2 id="titulo-ejemplos" className="text-base font-bold text-tinta mb-4">
            Así se ve la comparación
          </h2>
          {ejemplos.map((producto) => (
            <EjemploComparacion key={producto.id_producto} p={producto} onVer={elegir} />
          ))}
        </section>
      )}

      {!id && consulta.length < 2 && <CuantoConvieneComparar />}

      {!id && consulta.length < 2 && (
        <section aria-labelledby="titulo-destacados">
          <h2 id="titulo-destacados" className="text-base font-bold text-tinta mb-3">
            Las mayores diferencias de hoy
          </h2>
          {destacados === null && <p className="text-sm text-tinta-suave">Cargando…</p>}
          {destacados?.error && <Aviso>{destacados.error}</Aviso>}
          {destacados?.productos && (
            <>
              <ul className="tarjeta divide-y divide-linea overflow-hidden">
                {destacados.productos.map((producto) => (
                  <FilaProducto
                    key={producto.id_producto}
                    producto={producto}
                    onElegir={elegir}
                    enLista={enLista(producto.id_producto)}
                    onAgregar={agregar}
                  />
                ))}
              </ul>
              <p className="mt-3 text-xs text-tinta-suave leading-relaxed">
                Solo productos que venden {EMPRESAS_MINIMAS} o más empresas distintas -no banderas de la misma,
                como las cuatro de Carrefour-, con el precio más bajo y el más alto informados por{" "}
                {SUCURSALES_MINIMAS} o más sucursales cada uno: así una sucursal con un precio mal cargado no puede
                aparecer como la mayor diferencia del día.
              </p>
            </>
          )}
        </section>
      )}
    </div>
  );
}

export default MismoProductoPage;
