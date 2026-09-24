import { useEffect, useState } from "react";
import { obtenerComposicionCanasta } from "../api/client";
import type { GrupoComposicion } from "../types";

/** 6750 g -> "6,75 kg"; 420 g -> "420 g"; 9270 cc -> "9,27 l"; 11 -> "11 u." */
function formatearCantidad(cantidad: number, unidad: GrupoComposicion["items"][number]["unidad"]): string {
  const numero = (n: number) => n.toLocaleString("es-AR", { maximumFractionDigits: 2 });
  if (unidad === "unidad") return `${numero(cantidad)} u.`;
  if (cantidad >= 1000) return `${numero(cantidad / 1000)} ${unidad === "g" ? "kg" : "l"}`;
  return `${numero(cantidad)} ${unidad === "g" ? "g" : "ml"}`;
}

/*
  Que tiene la canasta, por adulto y por mes.

  Sin esto la pagina mostraba un total de $243.000 sin decir que se compraba
  con eso ni para cuantas personas, y era natural compararlo con Tu canasta de
  una familia entera (que para 4 personas daba $759.000). Va plegado: la
  primera linea ya dice lo esencial, y quien quiere la lista la despliega.
*/
function ComposicionCanasta() {
  const [grupos, setGrupos] = useState<GrupoComposicion[] | null>(null);

  useEffect(() => {
    let cancelado = false;
    obtenerComposicionCanasta()
      .then((g) => {
        if (!cancelado) setGrupos(g);
      })
      // Si falla, la pagina sigue: la composicion es un complemento del ranking.
      .catch(() => {});
    return () => {
      cancelado = true;
    };
  }, []);

  if (!grupos || grupos.length === 0) return null;
  const total = grupos.reduce((n, g) => n + g.items.length, 0);

  return (
    <details className="group mb-8 rounded-2xl bg-papel border border-linea">
      <summary className="cursor-pointer list-none px-5 py-4 sm:px-7 flex items-baseline justify-between gap-4">
        <span>
          <span className="font-medium text-tinta">Que incluye la canasta</span>
          <span className="block text-sm text-tinta-media mt-0.5">
            {total} alimentos para un adulto durante un mes: pan, carne, leche, frutas, verduras y el resto de la
            dieta basica que define el INDEC.
          </span>
        </span>
        <span className="text-sm text-tinta-suave shrink-0 group-open:hidden">Ver lista</span>
        <span className="text-sm text-tinta-suave shrink-0 hidden group-open:inline">Ocultar</span>
      </summary>
      <div className="px-5 pb-6 sm:px-7 grid gap-x-8 gap-y-5 sm:grid-cols-2 lg:grid-cols-3 border-t border-linea pt-5">
        {grupos.map((g) => (
          <div key={g.grupo}>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-tinta-suave mb-2">{g.grupo}</h3>
            <ul className="space-y-1">
              {g.items.map((item) => (
                <li key={item.categoria} className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="text-tinta">{item.categoria}</span>
                  <span className="numero text-tinta-media shrink-0">{formatearCantidad(item.cantidad, item.unidad)}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </details>
  );
}

export default ComposicionCanasta;
