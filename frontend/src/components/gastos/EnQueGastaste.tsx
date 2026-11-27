import { useState } from "react";
import type { Gasto } from "../../types";
import { CATEGORIA_SIN_DETALLE } from "../../utils/gastos";
import { formatearPesos } from "../../utils/formato";
import { nombreCategoria } from "../../utils/nombres";
import { nombreLegible } from "../../utils/texto";
import {
  comprasPorSuper,
  porRubro,
  productosDelMes,
  productosDeRubro,
  RUBRO_OTROS,
  type FilaResumen,
  type MapaRubros,
  type ProductoDelMes,
} from "../../utils/resumenGastos";
import { DonaCategorias, PorSuper } from "./GraficosDelMes";

/*
  "En que gastaste" (openspec app-para-el-usuario): la dona por rubro, con un
  selector para ver el mes por productos o por super. Tocar un rubro muestra sus
  productos -los codigos de los tickets lo permiten- sin saturar: un rubro a la
  vez, los primeros 5 y el resto a un toque.
*/

const PRIMEROS = 5;
type Vista = "rubros" | "productos" | "super";

function ListaDeProductos({ productos, verTodos, onVerTodos, conCadena }: {
  productos: ProductoDelMes[];
  verTodos: boolean;
  onVerTodos: () => void;
  conCadena?: boolean;
}) {
  const visibles = verTodos ? productos : productos.slice(0, PRIMEROS);
  return (
    <>
      <ul className="divide-y divide-linea">
        {visibles.map((p) => (
          <li key={p.clave} className="flex items-baseline justify-between gap-3 py-1.5 text-sm">
            <span className="min-w-0 truncate text-tinta-media">
              {nombreLegible(p.nombre, null)}{" "}
              <span className="text-xs font-semibold text-tinta-suave">
                ×{Math.round(p.cantidad * 100) / 100}
                {conCadena && ` · ${p.cadenas.join(", ")}`}
              </span>
            </span>
            <span className="shrink-0 font-bold text-tinta numero">{formatearPesos(Math.round(p.total))}</span>
          </li>
        ))}
      </ul>
      {!verTodos && productos.length > PRIMEROS && (
        <button type="button" onClick={onVerTodos} className="mt-1 text-sm font-semibold text-marca min-h-11">
          + {productos.length - PRIMEROS} productos más
        </button>
      )}
    </>
  );
}

export default function EnQueGastaste({
  gastos,
  porCategoria,
  porSuper,
  total,
  rubros,
}: {
  gastos: Gasto[];
  porCategoria: FilaResumen[];
  porSuper: FilaResumen[];
  total: number;
  /** null mientras llega o si fallo: se agrupa por categoria, como antes. */
  rubros: MapaRubros | null;
}) {
  const [vista, setVista] = useState<Vista>("rubros");
  const [elegido, setElegido] = useState<string | null>(null);
  const [verTodos, setVerTodos] = useState(false);
  const conRubros = rubros !== null && Object.keys(rubros).length > 0;
  const filas = conRubros ? porRubro(porCategoria, rubros) : porCategoria.map((f) => ({ ...f, nombre: nombreCategoria(f.nombre) }));
  const productos = productosDelMes(gastos, rubros ?? {});
  const visibles = filas.map((f) => f.nombre).filter((n) => n !== RUBRO_OTROS && n !== CATEGORIA_SIN_DETALLE);
  const delElegido = elegido && conRubros ? productosDeRubro(productos, elegido, visibles) : [];
  const totalElegido = filas.find((f) => f.nombre === elegido)?.total ?? 0;

  const elegir = (nombre: string) => {
    setElegido((previo) => (previo === nombre ? null : nombre));
    setVerTodos(false);
  };

  return (
    <section className="tarjeta p-5 sm:p-6 mb-4" aria-labelledby="titulo-categorias">
      <h2 id="titulo-categorias" className="text-base font-bold text-tinta mb-3">
        En qué gastaste
      </h2>
      <div className="grid grid-cols-3 bg-papel-hundido rounded-xl p-1 mb-4" role="group" aria-label="Ver el mes por">
        {(
          [
            ["rubros", conRubros ? "Rubros" : "Categorías"],
            ["productos", "Productos"],
            ["super", "Súper"],
          ] as [Vista, string][]
        ).map(([valor, texto]) => (
          <button
            key={valor}
            type="button"
            aria-pressed={vista === valor}
            onClick={() => {
              setVista(valor);
              setVerTodos(false);
            }}
            className={`rounded-lg min-h-10 text-sm font-bold ${vista === valor ? "bg-papel text-tinta shadow-sm" : "text-tinta-media"}`}
          >
            {texto}
          </button>
        ))}
      </div>

      {vista === "rubros" && (
        <>
          <DonaCategorias filas={filas} total={total} elegido={conRubros ? elegido : null} onElegir={conRubros ? elegir : undefined} />
          {conRubros && !elegido && productos.length > 0 && (
            <p className="mt-3 text-xs text-tinta-suave">Tocá un rubro para ver sus productos.</p>
          )}
          {elegido && delElegido.length > 0 && (
            <div className="mt-4 rounded-2xl bg-papel-hundido p-3" aria-live="polite">
              <p className="flex items-baseline justify-between text-sm font-bold text-tinta mb-1">
                <span>{elegido}</span>
                <span className="numero">{formatearPesos(Math.round(totalElegido))}</span>
              </p>
              <ListaDeProductos productos={delElegido} verTodos={verTodos} onVerTodos={() => setVerTodos(true)} />
            </div>
          )}
          {!conRubros && rubros !== null && (
            <p className="mt-3 text-xs text-tinta-suave">Por ahora, por categoría: no pudimos traer los rubros.</p>
          )}
        </>
      )}

      {vista === "productos" &&
        (productos.length > 0 ? (
          <>
            <p className="text-sm text-tinta-media mb-1">Lo que más plata se llevó este mes</p>
            <ListaDeProductos productos={productos} verTodos={verTodos} onVerTodos={() => setVerTodos(true)} conCadena />
          </>
        ) : (
          <p className="text-sm text-tinta-media">Los productos salen de los tickets con foto. Los montos a mano no los detallan.</p>
        ))}

      {vista === "super" && <PorSuper filas={porSuper} total={total} compras={comprasPorSuper(gastos)} />}
    </section>
  );
}
