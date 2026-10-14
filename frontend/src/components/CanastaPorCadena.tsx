import { useEffect, useState } from "react";
import { cotizarCanastaPorCadena } from "../api/client";
import { formatearPesos } from "../utils/formato";
import { esMayorista } from "../utils/mayoristas";
import { nombreCategoria } from "../utils/nombres";
import EtiquetaMayorista from "./EtiquetaMayorista";
import type { CanastaPorCadena as Resultado, ItemCanastaIA, LocalidadOpcion } from "../types";

/*
  Tu canasta en cada super (2026-10-14).

  "Si hago toda la compra en un solo lugar, ¿cuanto me sale en cada uno?". La
  respuesta va en pesos y con el ahorro dicho, que es lo que se recuerda: "en X
  te sale $111.000 y en Y $252.000".

  Los mayoristas se muestran, marcados, pero el titular es el super comun mas
  barato: quien no compra por bulto no va a cruzar la ciudad hasta un Maxi. Si
  el mayorista sale mas barato todavia, se dice aparte y con cuanto.

  Los totales son sobre las categorias que venden TODAS las cadenas de la
  lista (ver canasta_por_cadena en la API): una cadena a la que le falta la
  carne sumaria menos sin ser mas barata. Por eso el numero puede ser menor que
  el costo de la canasta de arriba, y se dice cuantas categorias entran.
*/

type Props = { items: ItemCanastaIA[]; localidades: LocalidadOpcion[] };
type Estado = { clave: string; resultado?: Resultado; error?: string };

const VISIBLES = 8;

function CanastaPorCadena({ items, localidades }: Props) {
  // Lo que se cotiza, serializado: es la dependencia del efecto (un arreglo
  // nuevo en cada render dispararia un pedido por render).
  const clave = JSON.stringify([
    items.map((i) => [i.categoria, i.cantidad, i.unidad, i.gama]),
    localidades.map((l) => [l.localidad, l.provincia]),
  ]);
  const [estado, setEstado] = useState<Estado | null>(null);
  const [verTodas, setVerTodas] = useState(false);

  useEffect(() => {
    let cancelado = false;
    // Un momento de espera: cambiar varias cantidades seguidas no tiene que
    // disparar un pedido por toque.
    const espera = setTimeout(() => {
      const [crudos, zonas] = JSON.parse(clave) as [[string, number, string, string][], [string, string][]];
      cotizarCanastaPorCadena(
        crudos.map(([categoria, cantidad, unidad, gama]) => ({ categoria, cantidad, unidad, gama, razon: "" })),
        zonas.map(([localidad, provincia]) => ({ localidad, provincia }))
      )
        .then((resultado) => !cancelado && setEstado({ clave, resultado }))
        .catch((err) => !cancelado && setEstado({ clave, error: err.message }));
    }, 300);
    return () => {
      cancelado = true;
      clearTimeout(espera);
    };
  }, [clave]);

  // Mientras llega la cotizacion nueva se sigue mostrando la anterior.
  const r = estado?.resultado;
  if (estado?.error) return null; // La seccion es un extra: si falla, no tapa el resto.
  if (!r || r.cadenas.length < 2) return null;

  const supers = r.cadenas.filter((c) => !esMayorista(c.cadena));
  const barato = supers[0] ?? r.cadenas[0];
  const caro = r.cadenas[r.cadenas.length - 1];
  const ahorro = caro.total - barato.total;
  const mayoristaMasBarato = r.cadenas[0] !== barato && esMayorista(r.cadenas[0].cadena) ? r.cadenas[0] : null;
  const maximo = caro.total;
  const visibles = verTodas ? r.cadenas : r.cadenas.slice(0, VISIBLES);

  return (
    <section aria-labelledby="titulo-por-cadena" className="mt-8 tarjeta p-4 sm:p-6">
      <div className="flex gap-3 mb-4">
        <span aria-hidden="true" className="shrink-0 w-11 h-11 rounded-xl bg-ahorro-tenue grid place-items-center text-2xl">
          🏪
        </span>
        <div>
          <h2 id="titulo-por-cadena" className="font-display text-xl text-tinta">
            Tu canasta en cada súper
          </h2>
          <p className="text-sm text-tinta-media">Si hacés toda la compra en un solo lugar.</p>
        </div>
      </div>

      <p className="text-lg sm:text-xl text-tinta leading-snug mb-1">
        En <strong className="font-bold">{barato.cadena}</strong> te sale{" "}
        <strong className="font-bold numero">{formatearPesos(barato.total)}</strong>
        {ahorro > 0 && (
          <>
            {" "}
            y en {caro.cadena} {formatearPesos(caro.total)}:{" "}
            <span className="text-ahorro font-extrabold numero">
              ahorrás {formatearPesos(ahorro)} ({Math.round((ahorro / caro.total) * 100)}%)
            </span>
          </>
        )}
      </p>
      {mayoristaMasBarato && (
        <p className="text-sm text-tinta-media mb-1">
          Contando mayoristas, en {mayoristaMasBarato.cadena} te sale{" "}
          <span className="numero font-semibold text-tinta">{formatearPesos(mayoristaMasBarato.total)}</span>,{" "}
          {formatearPesos(barato.total - mayoristaMasBarato.total)} menos que en {barato.cadena}.
        </p>
      )}

      <ul className="mt-4 space-y-2">
        {visibles.map((c) => {
          const esElBarato = c === barato;
          return (
            <li
              key={c.cadena}
              className="grid grid-cols-[minmax(0,8.5rem)_1fr_auto] sm:grid-cols-[13rem_1fr_auto] items-center gap-3"
              title={c.con_otra_gama > 0 ? `${c.con_otra_gama} categorías con otra gama: no tiene la que elegiste` : undefined}
            >
              <span className={`text-sm truncate ${esElBarato ? "font-bold text-tinta" : "text-tinta-media"}`}>
                {c.cadena}
                {esMayorista(c.cadena) && <EtiquetaMayorista />}
              </span>
              <span className="h-2.5 bg-papel-hundido rounded-full overflow-hidden" aria-hidden="true">
                <span
                  className={`block h-full rounded-full ${
                    esElBarato ? "bg-ahorro" : esMayorista(c.cadena) ? "bg-[#f5b54a]" : "bg-marca/40"
                  }`}
                  style={{ width: `${(c.total / maximo) * 100}%` }}
                />
              </span>
              <span className={`numero text-sm text-right ${esElBarato ? "font-bold text-tinta" : "text-tinta-media"}`}>
                {formatearPesos(c.total)}
              </span>
            </li>
          );
        })}
      </ul>
      {r.cadenas.length > VISIBLES && (
        <button
          onClick={() => setVerTodas((v) => !v)}
          className="mt-3 text-xs text-tinta-media underline underline-offset-2 hover:text-tinta"
        >
          {verTodas ? "Ver menos" : `Ver las ${r.cadenas.length - VISIBLES} restantes`}
        </button>
      )}

      <p className="mt-4 text-xs text-tinta-suave leading-relaxed">
        Precio mediano de cada cadena{" "}
        {r.ambito === "zona" ? "en las sucursales de tu zona" : "entre todas sus sucursales del país"}, sumando las{" "}
        {r.categorias_comparadas.length} de tus {r.total_categorias} categorías que venden todas, para comparar
        parejo.
        {r.categorias_afuera.length > 0 &&
          ` Quedan afuera ${r.categorias_afuera.map(nombreCategoria).join(", ")}.`}
        {r.cadenas_afuera.length > 0 &&
          ` No entran ${r.cadenas_afuera.map((c) => c.cadena).join(", ")}: venden menos del 80% de tu canasta.`}
        {r.ambito === "pais" && localidades.length > 0 && " En tu zona hay una sola cadena, así que se compara el país."}
      </p>
    </section>
  );
}

export default CanastaPorCadena;
