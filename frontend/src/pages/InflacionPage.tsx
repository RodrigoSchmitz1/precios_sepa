import { useState, useEffect } from "react";
import { obtenerInflacion, obtenerCategoriasInflacion } from "../api/client";
import SelectorCategoria from "../components/SelectorCategoria";
import TileKPI from "../components/TileKPI";
import { formatearPesos } from "../utils/formato";
import type { Inflacion } from "../types";

// Ver el comentario en CanastaPage: el estado de carga se deriva comparando la
// categoria que produjo el resultado contra la que esta elegida ahora.
type Estado = { categoria: string; filas?: Inflacion[]; error?: string };

function conSigno(valor: number): string {
  return `${valor > 0 ? "+" : ""}${valor}%`;
}

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

  const ordenadas = [...filas].sort((a, b) => b.variacion_pct - a.variacion_pct);
  const laQueMasSubio = ordenadas[0];
  const laQueMasBajo = ordenadas[ordenadas.length - 1];
  const promedio =
    filas.length > 0 ? filas.reduce((suma, r) => suma + r.variacion_pct, 0) / filas.length : 0;

  return (
    <div className="max-w-4xl mx-auto">
      <header className="mb-5">
        <h1 className="font-display text-4xl text-tinta mb-2">Inflacion por categoria</h1>
        <p className="text-tinta-media leading-relaxed">
          Variacion de precios por cadena, medida sobre los productos presentes en las
          dos fechas y encadenando los cambios dia a dia. Comparar el precio promedio de
          dos fechas sueltas mezclaria los cambios de precio con los cambios de surtido.
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
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-7">
            <TileKPI
              etiqueta="Variacion promedio"
              tono={promedio > 0 ? "ocre" : "verde"}
              valor={conSigno(Number(promedio.toFixed(1)))}
              detalle={`entre las ${filas.length} cadenas`}
            />
            <TileKPI
              etiqueta="La que mas subio"
              tono="ocre"
              valor={laQueMasSubio.cadena}
              detalle={conSigno(laQueMasSubio.variacion_pct)}
            />
            <TileKPI
              etiqueta="La que mas bajo"
              tono="verde"
              valor={laQueMasBajo.cadena}
              detalle={conSigno(laQueMasBajo.variacion_pct)}
            />
            <TileKPI
              etiqueta="Periodo medido"
              tono="azul"
              valor={<span className="text-lg">{filas[0].fecha_inicio}</span>}
              detalle={`hasta ${filas[0].fecha_fin}`}
            />
          </div>

          <div className="bg-papel border border-linea rounded-2xl p-5">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-tinta-suave mb-1">
              Variacion por cadena
            </h2>
            <p className="text-xs text-tinta-suave mb-5">
              Las que subieron van a la derecha; las que bajaron, a la izquierda.
            </p>

            <div className="space-y-3">
              {filas.map((r) => {
                const subio = r.variacion_pct > 0;
                const bajo = r.variacion_pct < 0;
                return (
                  <div
                    key={`${r.cadena}-${r.unidad_normalizada}`}
                    title={`${r.cadena} (por ${r.unidad_normalizada}): nivel actual ${formatearPesos(r.precio_actual)}, variacion encadenada ${conSigno(r.variacion_pct)} entre ${r.fecha_inicio} y ${r.fecha_fin}`}
                  >
                    <div className="flex items-baseline justify-between gap-3 mb-1.5">
                      <span className="text-sm text-tinta-media">
                        {r.cadena}
                        <span className="text-xs text-tinta-suave"> por {r.unidad_normalizada}</span>
                      </span>
                      <div className="flex items-baseline gap-2.5 shrink-0">
                        {/*
                          El nivel actual le da escala al porcentaje: un +8% no
                          dice lo mismo sobre $900 que sobre $9.000. No se
                          muestra un "precio inicial" porque la variacion no
                          sale de restar dos niveles sino de encadenar los
                          cambios diarios sobre productos pareados; ponerlos
                          juntos sugeriria una aritmetica que no es la que se
                          hizo.
                        */}
                        <span className="numero text-xs text-tinta-suave">
                          {formatearPesos(r.precio_actual)}
                        </span>
                        <span
                          className={[
                            "numero text-sm font-semibold w-16 text-right",
                            subio ? "text-alerta" : bajo ? "text-dato-verde" : "text-tinta-suave",
                          ].join(" ")}
                        >
                          {conSigno(r.variacion_pct)}
                        </span>
                      </div>
                    </div>

                    {/*
                      Barra divergente con gris neutro en el medio.

                      El par verde/terracota queda en la banda 6-8 de separacion
                      para daltonismo (medido: ΔE 7.5 en deutan), que el metodo
                      permite SOLO con codificacion secundaria. La hay, y es
                      doble: el lado respecto de la linea central y el signo
                      explicito en el numero. Se eligio sostener la convencion
                      del dominio (verde = mas barato) en vez de azul/rojo.
                    */}
                    <div className="relative h-2 bg-papel-hundido rounded-full">
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
        </>
      )}
    </div>
  );
}

export default InflacionPage;
