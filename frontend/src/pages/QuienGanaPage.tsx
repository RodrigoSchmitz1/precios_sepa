import { useState, useEffect } from "react";
import { obtenerQuienGana, obtenerCategoriasDisponibles } from "../api/client";
import SelectorCategoria from "../components/SelectorCategoria";
import Titular, { Resaltado } from "../components/Titular";
import FilaDeCifras from "../components/FilaDeCifras";
import { formatearNumero } from "../utils/formato";
import type { QuienGana } from "../types";

/*
  Supermercado mas barato, categoria por categoria.

  El titular nombra al lider con su tasa, que es lo que el lector viene a
  buscar; la metodologia (EAN comun, denominador por surtido propio) queda en la
  bajada.

  El grafico sigue siendo de barras y NO una tira de puntos: la tasa se lee
  contra 100, no contra el rango de los datos. Una tira que escale del minimo al
  maximo haria ver enorme la diferencia entre 12% y 18%.
*/

// Ver el comentario en CanastaPage: el estado de carga se deriva comparando la
// categoria que produjo el resultado contra la que esta elegida ahora.
type Estado = { categoria: string; filas?: QuienGana[]; error?: string };

function QuienGanaPage() {
  const [categorias, setCategorias] = useState<string[]>([]);
  const [categoriaElegida, setCategoriaElegida] = useState("");
  const [estado, setEstado] = useState<Estado | null>(null);
  const [errorCategorias, setErrorCategorias] = useState<string | null>(null);

  useEffect(() => {
    obtenerCategoriasDisponibles()
      .then((lista) => {
        setCategorias(lista);
        if (lista.length > 0) setCategoriaElegida(lista[0]);
      })
      .catch((err) => setErrorCategorias(err.message));
  }, []);

  useEffect(() => {
    if (!categoriaElegida) return;
    let cancelado = false;

    obtenerQuienGana(categoriaElegida)
      .then((filas) => {
        if (!cancelado) setEstado({ categoria: categoriaElegida, filas });
      })
      .catch((err) => {
        if (!cancelado) setEstado({ categoria: categoriaElegida, error: err.message });
      });

    return () => {
      cancelado = true;
    };
  }, [categoriaElegida]);

  const vigente = estado?.categoria === categoriaElegida ? estado : null;
  const filas = vigente?.filas ?? [];
  const lider = filas[0];
  // Cuanto del universo comparable ofrece el lider: es el contexto que evita
  // leer "gana siempre" cuando en realidad compite en pocos productos.
  const surtidoLider = lider
    ? Math.round((lider.productos_ofrecidos / lider.total_productos_categoria) * 100)
    : 0;

  return (
    <div className="max-w-4xl mx-auto">
      <Titular
        antetitulo={categoriaElegida ? `Mas barato · ${categoriaElegida}` : "Mas barato"}
        bajada={
          <>
            <p>
              Solo se comparan productos identicos, con el mismo codigo de barras, presentes en dos o mas cadenas: asi
              la marca propia no le regala victorias a nadie. Y se mide sobre los productos que cada cadena
              efectivamente ofrece, no sobre el total de la categoria, para que tener un surtido mas amplio no se
              confunda con ser mas barato.
            </p>
            {lider && (
              <p className="mt-2 text-sm text-tinta-suave">
                {lider.cadena} ofrece {surtidoLider}% de los {formatearNumero(lider.total_productos_categoria)}{" "}
                productos comparables de la categoria.
              </p>
            )}
          </>
        }
      >
        {lider ? (
          <>
            En {categoriaElegida.toLowerCase()}, {lider.cadena} tiene el precio mas bajo en{" "}
            <Resaltado tono="barato">{lider.pct_gana_cuando_compite}%</Resaltado> de los productos que vende
          </>
        ) : (
          "Que cadena tiene el precio mas bajo en cada categoria"
        )}
      </Titular>

      <div className="mb-8">
        <SelectorCategoria categorias={categorias} elegida={categoriaElegida} onElegir={setCategoriaElegida} />
      </div>

      {errorCategorias && (
        <p className="text-sm text-alerta bg-alerta-tenue border border-alerta/20 rounded-lg px-3 py-2">
          No se pudieron cargar las categorias: {errorCategorias}
        </p>
      )}

      {!errorCategorias && vigente === null && <p className="text-sm text-tinta-suave">Cargando…</p>}

      {vigente?.error && (
        <p className="text-sm text-alerta bg-alerta-tenue border border-alerta/20 rounded-lg px-3 py-2">
          No se pudo cargar: {vigente.error}
        </p>
      )}

      {lider && (
        <>
          <div className="mb-8">
            <FilaDeCifras
              cifras={[
                { etiqueta: "Gana mas seguido", valor: lider.cadena, detalle: `${lider.pct_gana_cuando_compite}% de los que ofrece` },
                {
                  etiqueta: "Productos comparables",
                  valor: formatearNumero(lider.total_productos_categoria),
                  detalle: "presentes en dos o mas cadenas",
                },
                { etiqueta: "Cadenas", valor: formatearNumero(filas.length), detalle: "con al menos 20 comparables" },
              ]}
            />
          </div>

          <div>
            <div className="flex items-baseline justify-between gap-3 pb-2 border-b border-linea-fuerte">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-tinta-suave">
                De lo que ofrece, en cuanto tiene el precio mas bajo
              </h2>
              <span className="text-xs text-tinta-suave">sobre 100%</span>
            </div>

            <ul>
              {filas.map((r, i) => (
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
                        className={
                          i === 0
                            ? "numero text-sm font-semibold text-ahorro"
                            : "numero text-sm font-semibold text-tinta"
                        }
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

            <p className="text-xs text-tinta-suave mt-4 leading-relaxed">
              Un producto puede empatar en varias cadenas, y cada una mide sobre su propio surtido, asi que los
              porcentajes no suman 100. Solo entran cadenas con al menos 20 productos comparables en la categoria.
            </p>
          </div>
        </>
      )}
    </div>
  );
}

export default QuienGanaPage;
