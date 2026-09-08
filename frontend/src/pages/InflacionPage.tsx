import { useState, useEffect } from "react";
import { obtenerInflacion, obtenerCategoriasInflacion } from "../api/client";
import SelectorCategoria from "../components/SelectorCategoria";
import { formatearPesos } from "../utils/formato";
import type { Inflacion } from "../types";

// Ver el comentario en CanastaPage: el estado de carga se deriva comparando la
// categoria que produjo el resultado contra la que esta elegida ahora.
type Estado = { categoria: string; filas?: Inflacion[]; error?: string };

function InflacionPage() {
  const [categorias, setCategorias] = useState<string[]>([]);
  const [categoriaElegida, setCategoriaElegida] = useState("");
  const [estado, setEstado] = useState<Estado | null>(null);
  const [errorCategorias, setErrorCategorias] = useState<string | null>(null);

  useEffect(() => {
    obtenerCategoriasInflacion()
      .then((lista) => {
        setCategorias(lista);
        if (lista.length > 0) setCategoriaElegida(lista[0]);
      })
      .catch((err) => setErrorCategorias(err.message));
  }, []);

  useEffect(() => {
    if (!categoriaElegida) return;
    let cancelado = false;

    obtenerInflacion(categoriaElegida)
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
  const maximo = Math.max(...filas.map((r) => Math.abs(r.variacion_pct)), 1);

  return (
    <div className="max-w-3xl mx-auto">
      <header className="mb-5">
        <h1 className="font-display text-4xl text-tinta mb-2">Inflacion por categoria</h1>
        <p className="text-tinta-media leading-relaxed">
          Variacion de precios por cadena, comparando la primera y la ultima fecha
          registradas en el historico.
        </p>
      </header>

      <p className="text-xs text-aviso bg-aviso-tenue border border-aviso/20 rounded-lg px-3 py-2 mb-6">
        El historico recien empezo a acumularse. Con pocos dias de datos estas variaciones
        no representan una inflacion mensual real todavia: el dato se vuelve util con el
        tiempo.
      </p>

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

      {vigente?.filas && filas.length === 0 && (
        <p className="text-sm text-tinta-suave">
          Todavia no hay dos fechas en el historico para esta categoria.
        </p>
      )}

      {filas.length > 0 && (
        <>
          <p className="numero text-xs text-tinta-suave mb-4">
            Periodo: {filas[0].fecha_inicio} a {filas[0].fecha_fin}
          </p>

          <div className="grid gap-2">
            {filas.map((r) => {
              const subio = r.variacion_pct > 0;
              const bajo = r.variacion_pct < 0;
              return (
                <div key={r.cadena} className="bg-papel rounded-xl border border-linea p-3.5">
                  <div className="flex items-baseline justify-between gap-3 mb-2">
                    <span className="text-sm font-medium text-tinta">{r.cadena}</span>
                    <div className="flex items-baseline gap-2.5 shrink-0">
                      {/*
                        Los importes de inicio y fin le dan escala al porcentaje:
                        un +8% no dice lo mismo sobre $900 que sobre $9.000.
                      */}
                      <span className="numero text-xs text-tinta-suave">
                        {formatearPesos(r.precio_inicio)} → {formatearPesos(r.precio_fin)}
                      </span>
                      <span
                        className={[
                          "numero text-sm font-semibold",
                          subio ? "text-alerta" : bajo ? "text-ahorro" : "text-tinta-suave",
                        ].join(" ")}
                      >
                        {subio ? "+" : ""}
                        {r.variacion_pct}%
                      </span>
                    </div>
                  </div>

                  {/*
                    Barra divergente desde el centro: las subas van a la derecha
                    en rojo y las bajas a la izquierda en verde, para que se lea
                    de un vistazo quien aumento y quien no.
                  */}
                  <div className="relative h-1.5 bg-papel-hundido rounded-full">
                    <div className="absolute inset-y-0 left-1/2 w-px bg-linea-fuerte" />
                    <div
                      className={[
                        "absolute inset-y-0 rounded-full",
                        subio ? "left-1/2 bg-alerta" : "right-1/2 bg-ahorro",
                      ].join(" ")}
                      style={{ width: `${(Math.abs(r.variacion_pct) / maximo) * 50}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

export default InflacionPage;
