import { useEffect, useMemo, useRef, useState } from "react";
import { obtenerQuienGana, obtenerQuienGanaZona } from "../api/client";
import { useZona } from "../contexto/zona";
import { rotuloZona, zonaAParametro } from "../utils/zona";
import Titular, { Resaltado } from "../components/Titular";
import FilaDeCifras from "../components/FilaDeCifras";
import MapaDelMercado from "../components/MapaDelMercado";
import { formatearNumero } from "../utils/formato";
import { liderEn } from "../utils/liderazgo";
import type { QuienGana } from "../types";
import { nombreCadena, nombreCategoria } from "../utils/nombres";

/*
  Supermercado mas barato.

  La pagina abre con el mapa del mercado (categorias x cadenas) y el detalle de
  una categoria queda abajo. Antes era al reves: una categoria por vez, elegida
  en un selector de 58 opciones, sin forma de ver el conjunto.

  UNA SOLA CONSULTA. El mart entero del ultimo dia son unas 800 filas, asi que
  se trae completo y todo el resto (el mapa, el detalle de cada categoria, la
  lista de categorias) se calcula en el navegador. Antes cada categoria elegida
  era una consulta nueva a BigQuery -cada una con su clave de cache- mas otra
  para la lista de categorias.
*/

type Estado = { clave: string; filas?: QuienGana[]; error?: string };

function QuienGanaPage() {
  /*
    Con zona (2026-11), por defecto se compite solo entre las cadenas de la
    zona, recalculado en la API producto por producto: filtrar las filas del
    ranking nacional mentiria, porque cada porcentaje se calculo contra todas
    las cadenas del pais. Con una sola cadena en la zona no hay ranking local.
  */
  const { zona } = useZona();
  const [verPais, setVerPais] = useState(false);
  const zonaComparable = zona !== null && zona.cadenas.length >= 2;
  const enZona = zonaComparable && !verPais;
  const clave = enZona ? `zona:${zonaAParametro(zona)}` : "pais";
  const [estadoGuardado, setEstado] = useState<Estado | null>(null);
  const estado = estadoGuardado?.clave === clave ? estadoGuardado : null;
  const [categoriaElegida, setCategoriaElegida] = useState("");
  const detalleRef = useRef<HTMLDivElement>(null);

  // En el celular el detalle queda abajo de la lista: tocar una categoria sin
  // llevar hasta ahi parecia no hacer nada (2026-10-31).
  useEffect(() => {
    if (categoriaElegida && window.matchMedia("(max-width: 639px)").matches) {
      detalleRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [categoriaElegida]);

  useEffect(() => {
    let cancelado = false;
    const pedido = enZona && zona ? obtenerQuienGanaZona(zona.cadenas) : obtenerQuienGana("");
    pedido
      .then((filas) => {
        if (!cancelado) setEstado({ clave, filas });
      })
      .catch((err) => {
        if (!cancelado) setEstado({ clave, error: err.message });
      });
    return () => {
      cancelado = true;
    };
  }, [clave, enZona, zona]);

  const filas = useMemo(() => estado?.filas ?? [], [estado]);

  const resumen = useMemo(() => {
    if (filas.length === 0) return null;
    const categorias = [...new Set(filas.map((f) => f.categoria))];
    let comparables = 0;
    for (const categoria of categorias) {
      comparables += filas.find((f) => f.categoria === categoria)!.total_productos_categoria;
    }
    const [lider, categoriasLideradas] = liderEn(filas, categorias) ?? ["", 0];
    return {
      categorias,
      lider,
      categoriasLideradas,
      comparables,
      cadenas: new Set(filas.map((f) => f.cadena)).size,
    };
  }, [filas]);

  // Detalle de la categoria elegida, del mismo conjunto ya cargado.
  const detalle = useMemo(
    () =>
      filas
        .filter((f) => f.categoria === categoriaElegida)
        .sort((a, b) => b.pct_gana_cuando_compite - a.pct_gana_cuando_compite),
    [filas, categoriaElegida]
  );

  return (
    <div className="max-w-5xl mx-auto">
      <Titular
        antetitulo={
          resumen
            ? `Más barato · ${resumen.categorias.length} categorías · ${formatearNumero(resumen.comparables)} productos comparables`
            : "Más barato"
        }
        bajada={
          <p>
            Solo se comparan productos idénticos, con el mismo código de barras, presentes en dos o más cadenas: así
            la marca propia no le regala victorias a nadie. Y se mide sobre los productos que cada cadena
            efectivamente ofrece, no sobre el total de la categoría, para que tener un surtido más amplio no se
            confunda con ser más barato.
          </p>
        }
      >
        {resumen ? (
          <>
            {enZona && "En tu zona, "}
            <Resaltado tono="barato">{resumen.lider}</Resaltado> es la más barata en{" "}
            {resumen.categoriasLideradas} de las {resumen.categorias.length} categorías
          </>
        ) : (
          "Qué cadena tiene el precio más bajo en cada categoría"
        )}
      </Titular>

      {zona && !zonaComparable && (
        <p className="mb-6 text-sm text-tinta-media">
          En tu zona ({rotuloZona(zona)}) hay una sola cadena, {zona.cadenas.map(nombreCadena).join("")}: no hay con qué compararla ahí.
          Esto es todo el país.
        </p>
      )}
      {zonaComparable && zona && (
        <div className="mb-6 flex flex-wrap gap-2" role="group" aria-label="Qué cadenas comparar">
          {[
            { pais: false, texto: `📍 ${rotuloZona(zona)}` },
            { pais: true, texto: "Todo el país" },
          ].map((opcion) => (
            <button
              key={opcion.texto}
              type="button"
              onClick={() => setVerPais(opcion.pais)}
              aria-pressed={verPais === opcion.pais}
              className={[
                "rounded-full px-4 py-2 text-sm font-semibold transition-colors",
                verPais === opcion.pais ? "bg-marca text-white" : "bg-papel text-tinta-media border border-linea-fuerte",
              ].join(" ")}
            >
              {opcion.texto}
            </button>
          ))}
        </div>
      )}
      {enZona && estado?.filas?.length === 0 && (
        <p className="mb-6 text-sm text-tinta-media">
          Las cadenas de tu zona no tienen suficientes productos en común para comparar. Mirá todo el país.
        </p>
      )}

      {estado === null && <p className="text-sm text-tinta-suave">Cargando…</p>}

      {estado?.error && (
        <p className="text-sm text-alerta bg-alerta-tenue border border-alerta/20 rounded-lg px-3 py-2">
          No se pudo cargar: {estado.error}
        </p>
      )}

      {resumen && (
        <>
          <div className="mb-8">
            <FilaDeCifras
              cifras={[
                {
                  etiqueta: "Gana en más categorías",
                  valor: resumen.lider,
                  detalle: `${resumen.categoriasLideradas} de ${resumen.categorias.length}`,
                },
                {
                  etiqueta: "Productos comparables",
                  valor: formatearNumero(resumen.comparables),
                  detalle: "en dos o más cadenas",
                },
                { etiqueta: "Cadenas", valor: formatearNumero(resumen.cadenas), detalle: "con 20 o más comparables" },
              ]}
            />
          </div>

          <div className="mb-8">
            <MapaDelMercado filas={filas} categoriaElegida={categoriaElegida} onElegir={setCategoriaElegida} />
          </div>

          {detalle.length === 0 ? (
            <p className="text-sm text-tinta-suave">Tocá una categoría del mapa para ver cadena por cadena.</p>
          ) : (
            <div ref={detalleRef} className="scroll-mt-24">
              <div className="flex items-baseline justify-between gap-3 pb-2 border-b border-linea-fuerte">
                <h2 className="text-base font-bold text-tinta">
                  {nombreCategoria(categoriaElegida)}: de lo que ofrece, en cuánto tiene el precio más bajo
                </h2>
                <button
                  onClick={() => setCategoriaElegida("")}
                  className="text-xs text-tinta-suave hover:text-tinta transition-colors"
                >
                  cerrar
                </button>
              </div>

              <ul>
                {detalle.map((r, i) => (
                  <li key={r.cadena} className="border-b border-linea py-3">
                    <div
                      className="flex items-baseline justify-between gap-3 mb-1.5"
                      title={`${r.cadena}: es la más barata en ${formatearNumero(r.productos_ganados)} de los ${formatearNumero(r.productos_ofrecidos)} productos comparables que ofrece (${r.pct_gana_cuando_compite}%). La categoría tiene ${formatearNumero(r.total_productos_categoria)} comparables en total.`}
                    >
                      <span className={i === 0 ? "text-sm font-medium text-tinta" : "text-sm text-tinta-media"}>
                        {r.cadena}
                      </span>
                      <span className="text-xs text-tinta-suave shrink-0">
                        <span className="numero">{formatearNumero(r.productos_ganados)}</span> de{" "}
                        <span className="numero">{formatearNumero(r.productos_ofrecidos)}</span>
                        {" · "}
                        <span
                          className={`numero text-sm font-semibold ${i === 0 ? "text-ahorro" : "text-tinta"}`}
                        >
                          {r.pct_gana_cuando_compite.toLocaleString("es-AR", { maximumFractionDigits: 1 })}%
                        </span>
                      </span>
                    </div>
                    {/* La barra va contra 100, no contra el maximo: escalarla al
                        lider exageraria diferencias de pocos puntos. */}
                    <div className="h-1.5 bg-papel-hundido rounded-full">
                      <div
                        className={`h-1.5 rounded-full ${i === 0 ? "bg-ahorro" : "bg-escala-2"}`}
                        style={{ width: `${r.pct_gana_cuando_compite}%` }}
                        role="presentation"
                      />
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <p className="text-xs text-tinta-suave mt-5 leading-relaxed">
            Un producto puede empatar en varias cadenas, y cada una mide sobre su propio surtido, así que los
            porcentajes no suman 100. Solo entran cadenas con al menos 20 productos comparables en la categoría; las demás no se miden.
          </p>
        </>
      )}
    </div>
  );
}

export default QuienGanaPage;
