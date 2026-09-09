import { useState, useEffect } from "react";
import { obtenerQuienGana, obtenerCategoriasDisponibles } from "../api/client";
import SelectorCategoria from "../components/SelectorCategoria";
import TileKPI from "../components/TileKPI";
import { formatearNumero } from "../utils/formato";
import type { QuienGana } from "../types";

// Ver el comentario en CanastaPage: el estado de carga se deriva comparando la
// categoria que produjo el resultado contra la que esta elegida ahora.
type Estado = { categoria: string; filas?: QuienGana[]; error?: string };

/*
  Escala secuencial de un solo tono: mas victorias, mas oscuro. Es la
  codificacion correcta para comparar magnitud, y el largo de la barra sigue
  llevando el dato, asi que el color refuerza en vez de sustituir.
*/
const ESCALA = ["bg-escala-1", "bg-escala-2", "bg-escala-3", "bg-escala-4", "bg-escala-5"];

function pasoDeEscala(valor: number, maximo: number): string {
  if (maximo <= 0) return ESCALA[0];
  const indice = Math.min(ESCALA.length - 1, Math.floor((valor / maximo) * ESCALA.length));
  return ESCALA[indice];
}

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

  // Ahora la tasa es sobre lo que cada cadena ofrece, asi que usa todo el rango
  // de 0 a 100 y las barras van contra 100: escalarlas contra el maximo
  // exageraria diferencias chicas.
  const lider = filas[0];

  return (
    <div className="max-w-4xl mx-auto">
      <header className="mb-6">
        <h1 className="font-display text-4xl text-tinta mb-2">Supermercado mas barato</h1>
        <p className="text-tinta-media leading-relaxed">
          Solo se comparan productos identicos, con el mismo codigo de barras, presentes
          en dos o mas cadenas: asi la marca propia no le regala victorias a nadie. Y se
          mide <strong className="font-semibold text-tinta">sobre los productos que cada
          cadena efectivamente ofrece</strong>, no sobre el total de la categoria, para
          que tener un surtido mas amplio no se confunda con ser mas barato.
        </p>
      </header>

      <div className="mb-6">
        <SelectorCategoria
          categorias={categorias}
          elegida={categoriaElegida}
          onElegir={setCategoriaElegida}
        />
      </div>

      {errorCategorias && (
        <p className="text-sm text-alerta bg-alerta-tenue border border-alerta/20 rounded-lg px-3 py-2">
          No se pudieron cargar las categorias: {errorCategorias}
        </p>
      )}

      {!errorCategorias && vigente === null && (
        <p className="text-sm text-tinta-suave">Cargando…</p>
      )}

      {vigente?.error && (
        <p className="text-sm text-alerta bg-alerta-tenue border border-alerta/20 rounded-lg px-3 py-2">
          No se pudo cargar: {vigente.error}
        </p>
      )}

      {filas.length > 0 && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-7">
            <TileKPI
              etiqueta="Gana mas seguido"
              tono="verde"
              valor={lider.cadena}
              detalle={`la mas barata en ${lider.pct_gana_cuando_compite}% de los productos que ofrece`}
            />
            <TileKPI
              etiqueta="Productos comparables"
              tono="azul"
              valor={formatearNumero(lider.total_productos_categoria)}
              detalle="presentes en dos o mas cadenas"
            />
            <TileKPI
              etiqueta="Cadenas comparadas"
              tono="ciruela"
              valor={formatearNumero(filas.length)}
              detalle={`en ${categoriaElegida.toLowerCase()}`}
            />
          </div>

          <div className="bg-papel border border-linea rounded-2xl p-5">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-tinta-suave mb-1">
              De los productos que ofrece, en cuantos tiene el precio mas bajo
            </h2>
            <p className="text-xs text-tinta-suave mb-4">
              El segundo numero es sobre cuantos productos compite cada una. La categoria
              tiene {formatearNumero(lider.total_productos_categoria)} comparables en total.
            </p>

            <div className="space-y-3.5">
              {filas.map((r) => (
                <div
                  key={r.cadena}
                  title={`${r.cadena}: es la mas barata en ${formatearNumero(r.productos_ganados)} de los ${formatearNumero(r.productos_ofrecidos)} productos comparables que ofrece (${r.pct_gana_cuando_compite}%). La categoria tiene ${formatearNumero(r.total_productos_categoria)} comparables en total.`}
                >
                  <div className="flex justify-between items-baseline gap-3 text-sm mb-1.5">
                    <span className="text-tinta-media">{r.cadena}</span>
                    <span className="text-xs text-tinta-suave shrink-0">
                      <span className="numero">{formatearNumero(r.productos_ganados)}</span> de{" "}
                      <span className="numero">{formatearNumero(r.productos_ofrecidos)}</span>
                      {" · "}
                      <span className="numero font-semibold text-tinta">{r.pct_gana_cuando_compite}%</span>
                    </span>
                  </div>
                  <div className="w-full bg-papel-hundido rounded-full h-2.5">
                    <div
                      className={`h-2.5 rounded-full ${pasoDeEscala(r.pct_gana_cuando_compite, 100)}`}
                      style={{ width: `${r.pct_gana_cuando_compite}%` }}
                      role="presentation"
                    />
                  </div>
                </div>
              ))}
            </div>

            <p className="text-xs text-tinta-suave mt-5 pt-4 border-t border-linea">
              Las barras van sobre 100%. Un producto puede empatar en varias cadenas, y cada
              una mide sobre su propio surtido, asi que los porcentajes no suman 100. Solo
              entran cadenas con al menos 20 productos comparables en la categoria.
            </p>
          </div>
        </>
      )}
    </div>
  );
}

export default QuienGanaPage;
