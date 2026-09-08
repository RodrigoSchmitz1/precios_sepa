import { useState, useEffect } from "react";
import { obtenerQuienGana, obtenerCategoriasDisponibles } from "../api/client";
import SelectorCategoria from "../components/SelectorCategoria";
import { formatearNumero } from "../utils/formato";
import type { QuienGana } from "../types";

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

  // Las barras se escalan contra la cadena que mas gana, no contra 100: los
  // porcentajes rara vez pasan del 30% y contra 100 quedarian todas aplastadas.
  const maximo = Math.max(...filas.map((r) => r.pct_victorias), 1);

  return (
    <div className="max-w-3xl mx-auto">
      <header className="mb-6">
        <h1 className="font-display text-4xl text-tinta mb-2">Supermercado mas barato</h1>
        <p className="text-tinta-media leading-relaxed">
          Comparacion honesta: solo productos identicos, con el mismo codigo de barras,
          presentes en dos o mas cadenas. Asi la marca propia de cada cadena no le
          regala victorias.
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
          <p className="text-xs text-tinta-suave mb-5">
            Base: {formatearNumero(filas[0].total_productos_categoria)} productos comparables
            en {categoriaElegida.toLowerCase()}
          </p>

          <div className="space-y-3.5">
            {filas.map((r, i) => (
              <div key={r.cadena}>
                <div className="flex justify-between items-baseline gap-3 text-sm mb-1.5">
                  <span className={i === 0 ? "font-semibold text-tinta" : "text-tinta-media"}>
                    {r.cadena}
                  </span>
                  <span className="text-xs text-tinta-suave shrink-0">
                    <span className="numero">{formatearNumero(r.productos_ganados)}</span> de{" "}
                    <span className="numero">{formatearNumero(r.total_productos_categoria)}</span>
                    {" · "}
                    <span className="numero font-semibold text-tinta">{r.pct_victorias}%</span>
                  </span>
                </div>
                <div className="w-full bg-papel-hundido rounded-full h-2.5 overflow-hidden">
                  <div
                    className={["h-full rounded-full", i === 0 ? "bg-ahorro" : "bg-ahorro/50"].join(" ")}
                    style={{ width: `${(r.pct_victorias / maximo) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>

          <p className="text-xs text-tinta-suave mt-5">
            Las barras estan a escala de la cadena que mas gana, no sobre 100%. Un producto
            puede empatar en varias cadenas, asi que los porcentajes no suman 100.
          </p>
        </>
      )}
    </div>
  );
}

export default QuienGanaPage;
