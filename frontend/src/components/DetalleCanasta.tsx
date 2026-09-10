import { useEffect, useState } from "react";
import { obtenerCanastaDetalle } from "../api/client";
import { formatearPesos, formatearNumero } from "../utils/formato";
import type { CanastaDetalle } from "../types";

/*
  Desglose de la canasta de una localidad, categoria por categoria.

  Un total de seis cifras sin nada detras es un numero que hay que creer. Aca el
  lector ve de que esta hecho, cuanto pesa cada categoria, a que precio por
  unidad se valuo y sobre cuantas observaciones se calculo esa mediana, y decide
  por su cuenta si le cierra. Es la diferencia entre publicar un dato y publicar
  un dato auditable.
*/

type Estado = { clave: string; filas?: CanastaDetalle[]; error?: string };

type Props = {
  localidad: string;
  provincia: string;
  total: number;
};

function DetalleCanasta({ localidad, provincia, total }: Props) {
  const clave = `${localidad}|${provincia}`;
  const [estado, setEstado] = useState<Estado | null>(null);

  useEffect(() => {
    let cancelado = false;
    obtenerCanastaDetalle(localidad, provincia)
      .then((filas) => {
        if (!cancelado) setEstado({ clave, filas });
      })
      .catch((err) => {
        if (!cancelado) setEstado({ clave, error: err.message });
      });
    return () => {
      cancelado = true;
    };
  }, [localidad, provincia, clave]);

  const vigente = estado?.clave === clave ? estado : null;

  if (vigente?.error) {
    return (
      <p className="text-xs text-alerta bg-alerta-tenue border border-alerta/20 rounded-lg px-3 py-2">
        No se pudo traer el detalle: {vigente.error}
      </p>
    );
  }

  if (!vigente?.filas) {
    return <p className="text-xs text-tinta-suave py-2">Cargando el detalle…</p>;
  }

  const filas = vigente.filas;
  const maximo = Math.max(...filas.map((f) => f.costo_categoria), 1);

  return (
    <div className="bg-papel-hundido rounded-xl p-4">
      <div className="flex items-baseline justify-between gap-3 mb-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-tinta-suave">
          Que compone la canasta en {localidad}
        </h3>
        <span className="text-xs text-tinta-suave">
          {filas.length} categorias · orden por peso en el total
        </span>
      </div>

      <ul className="space-y-1.5">
        {filas.map((f) => {
          const parte = total > 0 ? f.costo_categoria / total : 0;
          return (
            <li key={f.categoria}>
              <div className="flex items-baseline justify-between gap-3 text-xs mb-0.5">
                <span className="text-tinta-media truncate">
                  {f.categoria}
                  {f.origen_precio === "provincia" && (
                    <span
                      className="ml-1.5 text-[10px] font-medium uppercase tracking-wide text-aviso bg-aviso-tenue rounded px-1 py-px"
                      title="Esta localidad no junta 6 observaciones de la categoria: se usa la mediana de la provincia"
                    >
                      provincia
                    </span>
                  )}
                  <span className="text-tinta-suave">
                    {" "}
                    {formatearNumero(Math.round(f.cantidad_necesaria))} ×{" "}
                    <span className="numero">
                      {f.precio_mediano_unidad.toLocaleString("es-AR", {
                        style: "currency",
                        currency: "ARS",
                        maximumFractionDigits: 2,
                      })}
                    </span>
                    /u
                  </span>
                </span>
                <span className="shrink-0">
                  <span className="numero font-medium text-tinta">
                    {formatearPesos(f.costo_categoria)}
                  </span>
                  <span className="numero text-tinta-suave"> {(parte * 100).toFixed(0)}%</span>
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex-1 h-1 bg-linea rounded-full">
                  <div
                    className="h-1 rounded-full bg-escala-3"
                    style={{ width: `${(f.costo_categoria / maximo) * 100}%` }}
                    role="presentation"
                  />
                </div>
                {/*
                  Las muestras son el dato que permite juzgar cuan firme es cada
                  linea: una mediana sobre 800 observaciones no vale lo mismo que
                  una sobre 9, aunque las dos entren en el mismo total.
                */}
                <span
                  className="numero text-[10px] text-tinta-suave w-16 text-right"
                  title={
                    f.origen_precio === "provincia"
                      ? `Mediana de la provincia, sobre ${formatearNumero(f.muestras)} observaciones de precio`
                      : `Mediana calculada sobre ${formatearNumero(f.muestras)} observaciones de precio`
                  }
                >
                  {formatearNumero(f.muestras)} obs.
                </span>
              </div>
            </li>
          );
        })}
      </ul>

      <p className="text-[11px] text-tinta-suave mt-3 pt-3 border-t border-linea">
        Cada categoria se valua con la mediana del precio por unidad de los productos de
        gama economica de esa localidad, tras recortar el decil mas caro y el mas barato.
        Las cantidades salen de la canasta basica del INDEC, adaptada. Cuando la localidad no
        junta 6 observaciones de una categoria (pasa sobre todo con el pollo y el pescado
        frescos, que se venden en pocas sucursales) se usa la mediana de la provincia, en hasta
        2 de las 32 categorias: van marcadas.
      </p>
    </div>
  );
}

export default DetalleCanasta;
