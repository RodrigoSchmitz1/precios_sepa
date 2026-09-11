import { useEffect, useMemo, useState } from "react";
import { obtenerQuienGana } from "../api/client";
import Titular, { Resaltado } from "../components/Titular";
import FilaDeCifras from "../components/FilaDeCifras";
import MapaDelMercado from "../components/MapaDelMercado";
import { formatearNumero } from "../utils/formato";
import type { QuienGana } from "../types";

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

type Estado = { filas?: QuienGana[]; error?: string };

function QuienGanaPage() {
  const [estado, setEstado] = useState<Estado | null>(null);
  const [categoriaElegida, setCategoriaElegida] = useState("");

  useEffect(() => {
    let cancelado = false;
    obtenerQuienGana("")
      .then((filas) => {
        if (!cancelado) setEstado({ filas });
      })
      .catch((err) => {
        if (!cancelado) setEstado({ error: err.message });
      });
    return () => {
      cancelado = true;
    };
  }, []);

  const filas = useMemo(() => estado?.filas ?? [], [estado]);

  const resumen = useMemo(() => {
    if (filas.length === 0) return null;
    const categorias = [...new Set(filas.map((f) => f.categoria))];
    const liderazgos = new Map<string, number>();
    let comparables = 0;
    for (const categoria of categorias) {
      const deLaCategoria = filas.filter((f) => f.categoria === categoria);
      comparables += deLaCategoria[0].total_productos_categoria;
      const maximo = Math.max(...deLaCategoria.map((f) => f.pct_gana_cuando_compite));
      // Un empate en el tope cuenta para las dos: forzar un desempate seria
      // inventar una diferencia que los datos no tienen.
      for (const fila of deLaCategoria) {
        if (fila.pct_gana_cuando_compite === maximo) {
          liderazgos.set(fila.cadena, (liderazgos.get(fila.cadena) ?? 0) + 1);
        }
      }
    }
    const [lider, categoriasLideradas] = [...liderazgos.entries()].sort((a, b) => b[1] - a[1])[0];
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
    <div className="max-w-4xl mx-auto">
      <Titular
        antetitulo={
          resumen
            ? `Mas barato · ${resumen.categorias.length} categorias · ${formatearNumero(resumen.comparables)} productos comparables`
            : "Mas barato"
        }
        bajada={
          <p>
            Solo se comparan productos identicos, con el mismo codigo de barras, presentes en dos o mas cadenas: asi
            la marca propia no le regala victorias a nadie. Y se mide sobre los productos que cada cadena
            efectivamente ofrece, no sobre el total de la categoria, para que tener un surtido mas amplio no se
            confunda con ser mas barato.
          </p>
        }
      >
        {resumen ? (
          <>
            <Resaltado tono="barato">{resumen.lider}</Resaltado> es la mas barata en{" "}
            {resumen.categoriasLideradas} de las {resumen.categorias.length} categorias
          </>
        ) : (
          "Que cadena tiene el precio mas bajo en cada categoria"
        )}
      </Titular>

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
                  etiqueta: "Gana en mas categorias",
                  valor: resumen.lider,
                  detalle: `${resumen.categoriasLideradas} de ${resumen.categorias.length}`,
                },
                {
                  etiqueta: "Productos comparables",
                  valor: formatearNumero(resumen.comparables),
                  detalle: "en dos o mas cadenas",
                },
                { etiqueta: "Cadenas", valor: formatearNumero(resumen.cadenas), detalle: "con 20 o mas comparables" },
              ]}
            />
          </div>

          <div className="mb-8">
            <MapaDelMercado filas={filas} categoriaElegida={categoriaElegida} onElegir={setCategoriaElegida} />
          </div>

          {detalle.length === 0 ? (
            <p className="text-sm text-tinta-suave">Toca una categoria del mapa para ver cadena por cadena.</p>
          ) : (
            <div>
              <div className="flex items-baseline justify-between gap-3 pb-2 border-b border-linea-fuerte">
                <h2 className="text-xs font-semibold uppercase tracking-wider text-tinta-suave">
                  {categoriaElegida}: de lo que ofrece, en cuanto tiene el precio mas bajo
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
                      title={`${r.cadena}: es la mas barata en ${formatearNumero(r.productos_ganados)} de los ${formatearNumero(r.productos_ofrecidos)} productos comparables que ofrece (${r.pct_gana_cuando_compite}%). La categoria tiene ${formatearNumero(r.total_productos_categoria)} comparables en total.`}
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
                          {r.pct_gana_cuando_compite}%
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
            Un producto puede empatar en varias cadenas, y cada una mide sobre su propio surtido, asi que los
            porcentajes no suman 100. Solo entran cadenas con al menos 20 productos comparables en la categoria; las
            demas quedan como celda vacia en el mapa.
          </p>
        </>
      )}
    </div>
  );
}

export default QuienGanaPage;
