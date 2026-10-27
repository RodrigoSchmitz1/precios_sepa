import { useEffect, useState } from "react";
import { obtenerAhorroPorCategoria } from "../api/client";
import { nombreCadena, nombreCategoria } from "../utils/nombres";
import type { AhorroPorCategoria, ReglaDePrecio } from "../types";

/*
  Cuanto conviene comparar (2026-10-27).

  Los destacados muestran las mayores diferencias de un producto; esto dice
  cuanto se ahorra TIPICAMENTE comparando, por categoria: la mediana entre sus
  productos, no el extremo, que es el que arrastran los errores de la fuente.

  Al medirlo aparecio que buena parte de ese ahorro lo explican dos banderas
  que fijan sus precios con una regla: cobran lo mismo que su hermana de la
  misma empresa o un escalon fijo menos. La seccion lo dice con todas las
  letras, porque sin eso "conviene comparar" se leeria como dispersion del
  mercado cuando en buena parte es "anda a esta bandera".

  Las barras de "quien tiene el precio mas bajo" son una sola serie, asi que van
  en el color de marca y sin leyenda; el porcentaje esta escrito en cada fila.
*/

const CATEGORIAS_VISIBLES = 8;

function pct(valor: number, decimales = 0): string {
  return `${valor.toLocaleString("es-AR", { maximumFractionDigits: decimales })}%`;
}

/** "a", "a o b", "a, b o c". */
function listarConO(partes: string[]): string {
  return partes.length < 2 ? partes.join("") : `${partes.slice(0, -1).join(", ")} o ${partes[partes.length - 1]}`;
}

function TextoRegla({ r }: { r: ReglaDePrecio }) {
  const escalones = r.escalones.filter((e) => e.pct_productos >= 1);
  return (
    <p className="text-sm text-tinta-media leading-relaxed">
      <strong className="text-tinta">{nombreCadena(r.cadena)}</strong> cobra lo mismo que {nombreCadena(r.referencia)}{" "}
      en el {pct(r.pct_igual)} de los {r.productos.toLocaleString("es-AR")} productos que venden las dos, y menos en
      el {pct(r.pct_mas_barata)}
      {escalones.length > 0 && (
        <>
          : casi siempre{" "}
          {listarConO(escalones.map((e) => `un ${e.descuento_pct}% menos (${pct(e.pct_productos)} de los productos)`))}
        </>
      )}
      . Más cara, en el {pct(r.pct_mas_cara, 1)}.
    </p>
  );
}

function CuantoConvieneComparar() {
  const [datos, setDatos] = useState<AhorroPorCategoria | null>(null);
  const [error, setError] = useState(false);
  const [todas, setTodas] = useState(false);

  useEffect(() => {
    let cancelado = false;
    obtenerAhorroPorCategoria()
      .then((d) => {
        if (!cancelado) setDatos(d);
      })
      .catch(() => {
        if (!cancelado) setError(true);
      });
    return () => {
      cancelado = true;
    };
  }, []);

  // Es una seccion de contexto: si falla, la pagina sigue sin ella.
  if (error || !datos || datos.ahorro_mediano_pct === null || datos.categorias.length === 0) return null;

  const categorias = todas ? datos.categorias : datos.categorias.slice(0, CATEGORIAS_VISIBLES);
  const maximoGanadas = Math.max(...datos.mas_baratas.map((c) => c.pct), 1);

  return (
    <section aria-labelledby="titulo-conviene" className="mb-12">
      <h2 id="titulo-conviene" className="text-base font-bold text-tinta mb-1">
        Cuánto conviene comparar
      </h2>
      <p className="text-sm text-tinta-media mb-4 leading-relaxed">
        En la mitad de los {datos.productos.toLocaleString("es-AR")} productos que venden 3 o más empresas, la cadena más
        barata cobra al menos un <strong className="text-tinta">{pct(datos.ahorro_mediano_pct, 1)}</strong> menos que el
        precio típico del mercado.
      </p>

      <div className="grid gap-4 md:grid-cols-2 mb-4">
        <div className="tarjeta p-4">
          <h3 className="text-sm font-semibold text-tinta mb-3">Quién tiene el precio más bajo</h3>
          <ul className="space-y-2">
            {datos.mas_baratas.map((c) => (
              <li key={c.cadena} title={`${c.cadena}: el precio más bajo en ${c.productos.toLocaleString("es-AR")} productos`}>
                <div className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="text-tinta-media truncate">{nombreCadena(c.cadena)}</span>
                  <span className="numero text-tinta shrink-0">{pct(c.pct)}</span>
                </div>
                <div className="h-1.5 bg-papel-hundido rounded-full mt-0.5">
                  <div className="h-full bg-marca rounded-full" style={{ width: `${(c.pct / maximoGanadas) * 100}%` }} />
                </div>
              </li>
            ))}
          </ul>
          <p className="text-[11px] text-tinta-suave mt-3">
            De los productos comparables. Un empate cuenta para las dos cadenas, así que pueden sumar más de 100%.
          </p>
        </div>

        {datos.reglas.length > 0 && (
          <div className="tarjeta p-4">
            <h3 className="text-sm font-semibold text-tinta mb-3">No es casualidad: son reglas de precio</h3>
            <div className="space-y-3">
              {datos.reglas.map((r) => (
                <TextoRegla key={r.cadena} r={r} />
              ))}
            </div>
            <p className="text-[11px] text-tinta-suave mt-3">
              Son banderas de la misma empresa. Buena parte del ahorro por comparar es ir a la bandera que cobra un
              escalón menos.
            </p>
          </div>
        )}
      </div>

      <div className="tarjeta p-4">
        <h3 className="text-sm font-semibold text-tinta mb-1">Por categoría</h3>
        <p className="text-xs text-tinta-suave mb-3">
          Ahorro típico (la mediana entre sus productos) y la cadena que más veces tiene el precio más bajo.
        </p>
        <ul className="divide-y divide-linea">
          {categorias.map((c) => (
            <li key={c.categoria} className="flex items-baseline justify-between gap-3 py-1.5 text-sm">
              <span className="text-tinta-media truncate">{nombreCategoria(c.categoria)}</span>
              <span className="flex items-baseline gap-3 shrink-0">
                <span
                  className="text-xs text-tinta-suave hidden sm:inline"
                  title={`${nombreCadena(c.cadena_mas_barata)} tiene el precio más bajo en el ${pct(c.pct_mas_barata)} de ${c.productos} productos`}
                >
                  {nombreCadena(c.cadena_mas_barata)} · {pct(c.pct_mas_barata)}
                </span>
                <span className="numero font-semibold text-tinta w-14 text-right">{pct(c.ahorro_mediano_pct, 1)}</span>
              </span>
            </li>
          ))}
        </ul>
        {datos.categorias.length > CATEGORIAS_VISIBLES && (
          <button
            type="button"
            onClick={() => setTodas(!todas)}
            className="mt-2 text-sm text-marca font-medium hover:text-marca-hover"
          >
            {todas ? "Ver menos" : `Ver las ${datos.categorias.length} categorías`}
          </button>
        )}
      </div>
    </section>
  );
}

export default CuantoConvieneComparar;
