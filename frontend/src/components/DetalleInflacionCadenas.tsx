import { useEffect, useState } from "react";
import { obtenerInflacion } from "../api/client";
import { formatearVariacion, precioPorUnidad } from "../utils/formato";
import type { Inflacion } from "../types";

/*
  Apertura por cadena de la variacion de una categoria.

  El ranking de la pagina dice QUE se movio; esto dice DONDE. Es el segundo
  click, igual que el desglose de la canasta: el numero agregado se sostiene si
  el lector puede abrirlo y ver de que esta hecho. Aca eso significa ver si un
  -2,9% es todo el mercado bajando o una sola cadena arrastrando el promedio.
*/

type Estado = { categoria: string; filas?: Inflacion[]; error?: string };

function DetalleInflacionCadenas({ categoria }: { categoria: string }) {
  const [estado, setEstado] = useState<Estado | null>(null);

  useEffect(() => {
    let cancelado = false;
    obtenerInflacion(categoria)
      .then((filas) => {
        if (!cancelado) setEstado({ categoria, filas });
      })
      .catch((err) => {
        if (!cancelado) setEstado({ categoria, error: err.message });
      });
    return () => {
      cancelado = true;
    };
  }, [categoria]);

  const vigente = estado?.categoria === categoria ? estado : null;

  if (vigente?.error) {
    return (
      <p className="text-xs text-alerta bg-alerta-tenue border border-alerta/20 rounded-lg px-3 py-2">
        No se pudo traer el detalle: {vigente.error}
      </p>
    );
  }

  if (!vigente?.filas) {
    return <p className="text-xs text-tinta-suave py-2">Cargando las cadenas…</p>;
  }

  const filas = vigente.filas;
  if (filas.length === 0) {
    return (
      <p className="text-xs text-tinta-suave py-2">
        Ninguna cadena de esta categoria tiene la cadena de factores completa en el periodo.
      </p>
    );
  }

  const maximo = Math.max(...filas.map((r) => Math.abs(r.variacion_pct)), 0.01);

  return (
    <div className="bg-papel-hundido rounded-xl p-4">
      <div className="flex items-baseline justify-between gap-3 mb-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-tinta-suave">
          Cadena por cadena
        </h3>
        <span className="text-xs text-tinta-suave">
          {filas.length} series · la barra se escala al mayor movimiento de esta categoria
        </span>
      </div>

      <div className="space-y-2.5">
        {filas.map((r) => {
          const subio = r.variacion_pct > 0;
          const bajo = r.variacion_pct < 0;
          const nivel = precioPorUnidad(r.precio_actual, r.unidad_normalizada);
          return (
            <div
              key={`${r.cadena}-${r.unidad_normalizada}`}
              title={`${r.cadena}: nivel actual ${nivel.texto} por ${nivel.unidad}, variacion encadenada ${formatearVariacion(r.variacion_pct)} entre ${r.fecha_inicio} y ${r.fecha_fin}`}
            >
              <div className="flex items-baseline justify-between gap-3 mb-1">
                <span className="text-xs text-tinta-media truncate">
                  {r.cadena}
                </span>
                <div className="flex items-baseline gap-2.5 shrink-0">
                  {/*
                    El nivel actual le da escala al porcentaje: un +8% no dice lo
                    mismo sobre $900 que sobre $9.000. No se muestra un "precio
                    inicial" porque la variacion no sale de restar dos niveles
                    sino de encadenar los cambios diarios sobre productos
                    pareados; ponerlos juntos sugeriria una aritmetica que no es
                    la que se hizo.
                  */}
                  <span className="numero text-[11px] text-tinta-suave">
                    {nivel.texto}
                    <span className="text-tinta-suave"> /{nivel.unidad}</span>
                  </span>
                  <span
                    className={[
                      "numero text-xs font-semibold w-[4.5rem] text-right",
                      subio ? "text-alerta" : bajo ? "text-dato-verde" : "text-tinta-suave",
                    ].join(" ")}
                  >
                    {formatearVariacion(r.variacion_pct)}
                  </span>
                </div>
              </div>

              {/*
                Barra divergente con la linea de cero en el centro.

                El par verde/terracota queda en la banda 6-8 de separacion para
                daltonismo (medido: ΔE 7.5 en deutan), que el metodo permite
                SOLO con codificacion secundaria. La hay, y es doble: el lado
                respecto de la linea central y el signo explicito en el numero.
                Se eligio sostener la convencion del dominio (verde = mas
                barato) en vez de azul/rojo.
              */}
              <div className="relative h-1.5 bg-papel rounded-full">
                <div className="absolute inset-y-0 left-1/2 w-px bg-linea-fuerte" />
                <div
                  className={[
                    "absolute inset-y-0",
                    subio
                      ? "left-1/2 bg-alerta rounded-r-full"
                      : "right-1/2 bg-dato-verde rounded-l-full",
                  ].join(" ")}
                  style={{ width: `${(Math.abs(r.variacion_pct) / maximo) * 50}%` }}
                  role="presentation"
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default DetalleInflacionCadenas;
