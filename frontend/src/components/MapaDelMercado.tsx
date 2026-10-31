import { useState } from "react";
import type { QuienGana } from "../types";
import { categoriasGanadas, liderPorCategoria } from "../utils/liderazgo";
import { nombreCadena, nombreCategoria } from "../utils/nombres";
import { listarConY } from "../utils/texto";

/*
  Mapa del mercado: una grilla de categorias x cadenas, cada celda pintada segun
  cuan seguido esa cadena tiene el precio mas bajo en esa categoria.

  Por que existe: la pagina mostraba UNA categoria por vez, asi que para saber
  "quien es mas barato" habia que recorrer 58 selectores y acordarse de lo que
  decia cada uno. La grilla contesta de un vistazo lo que la lista contestaba de
  a una: que cadena es fuerte en que, y donde no compite.

  Como se lee:
  - Mas oscuro, gana mas seguido. La escala es relativa al maximo del dia, que
    ronda el 40%: pintar sobre 100 dejaria el mapa entero en el tono mas claro.
  - Celda vacia = esa cadena no llega a 20 productos comparables en esa
    categoria, asi que no se la mide. No es lo mismo que "gana 0%".
  - El color nunca es el unico dato: cada celda lleva su porcentaje en el title y
    tocar una fila abre el detalle con los numeros.

  Las cadenas se ordenan por en cuantas categorias lideran, asi la grilla se lee
  como un ranking de izquierda a derecha.
*/

/*
  2026-09-23: la grilla se agranda. Estaba en celdas de 12px con nombres de
  categoria en 11px y de cadena en 10px, y a ese cuerpo los nombres no se leian:
  el mapa se veia lindo de lejos y era inutil de cerca, que en un grafico cuya
  gracia es ubicar UNA categoria concreta es el peor resultado posible. Celdas
  de 20px y rotulos de 14 y 13px, con la columna de categorias mas ancha para
  que dejen de cortarse.
*/
/*
  2026-10-31: en el celular va una lista. Catorce columnas no entran en 414 px:
  se veian 4 cadenas, la columna de nombres ocupaba el 70% del ancho y en un
  iPhone la hoja parecia rota. Achicar la grilla no lo arregla, porque el dato
  deja de leerse; la pregunta que contesta en esa pantalla es quien gana en cada
  categoria, y eso entra en una fila. Tocarla abre el detalle, como en la grilla.
*/
const FILAS_EN_CELULAR = 12;

const PASOS = ["bg-escala-1", "bg-escala-2", "bg-escala-3", "bg-escala-4", "bg-escala-5"];

type Props = {
  filas: QuienGana[];
  categoriaElegida: string;
  onElegir: (categoria: string) => void;
};

function MapaDelMercado({ filas, categoriaElegida, onElegir }: Props) {
  const [todas, setTodas] = useState(false);
  if (filas.length === 0) return null;

  const categorias = [...new Set(filas.map((f) => f.categoria))].sort((a, b) => a.localeCompare(b, "es"));

  // Las cadenas se ordenan por en cuantas categorias lideran.
  const liderazgos = categoriasGanadas(filas, categorias);
  const lideres = liderPorCategoria(filas, categorias);
  const visibles = todas ? lideres : lideres.slice(0, FILAS_EN_CELULAR);

  const cadenas = [...new Set(filas.map((f) => f.cadena))].sort(
    (a, b) => (liderazgos.get(b) ?? 0) - (liderazgos.get(a) ?? 0) || a.localeCompare(b, "es")
  );

  const porCelda = new Map(filas.map((f) => [`${f.categoria}|${f.cadena}`, f]));
  const maximo = Math.max(...filas.map((f) => f.pct_gana_cuando_compite), 1);
  const paso = (pct: number) => PASOS[Math.min(PASOS.length - 1, Math.floor((pct / maximo) * PASOS.length))];

  return (
    <figure className="m-0 tarjeta p-4 sm:p-6">
      <figcaption className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 pb-3 mb-1 border-b border-linea">
        <h2 className="text-base font-bold text-tinta">
          El mapa del mercado
        </h2>
        <p className="sm:hidden text-xs text-tinta-suave w-full">
          La cadena que más seguido tiene el precio más bajo en cada categoría. Tocá una para ver todas.
        </p>
        <span className="hidden sm:flex items-center gap-1.5 text-[11px] text-tinta-suave">
          <span className="numero">0%</span>
          {PASOS.map((clase) => (
            <span key={clase} className={`w-4 h-2.5 rounded-[2px] ${clase}`} aria-hidden="true" />
          ))}
          <span className="numero">{Math.round(maximo)}%</span>
          <span className="text-linea-fuerte">·</span>
          <span className="w-4 h-2.5 rounded-[2px] bg-papel-hundido inline-block" aria-hidden="true" /> no compite
        </span>
      </figcaption>

      <div className="sm:hidden">
        <ul className="divide-y divide-linea">
          {visibles.map((l) => (
            <li key={l.categoria}>
              <button
                onClick={() => onElegir(l.categoria)}
                aria-pressed={l.categoria === categoriaElegida}
                className="w-full flex items-center justify-between gap-3 py-2.5 text-left"
              >
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-tinta">{nombreCategoria(l.categoria)}</span>
                  <span className="block text-xs text-tinta-suave">{listarConY(l.cadenas.map(nombreCadena))}</span>
                </span>
                <span className="numero text-sm font-semibold text-tinta shrink-0">{Math.round(l.pct)}%</span>
              </button>
            </li>
          ))}
        </ul>
        {lideres.length > FILAS_EN_CELULAR && (
          <button
            type="button"
            onClick={() => setTodas(!todas)}
            aria-expanded={todas}
            className="mt-1 py-2 text-sm text-marca font-medium"
          >
            {todas ? "Ver menos" : `Ver las ${lideres.length} categorías`}
          </button>
        )}
      </div>

      {/* La grilla scrollea sola si hace falta, con la columna de categorias
          fija: partirla en dos lineas la volveria ilegible. */}
      <div className="hidden sm:block overflow-x-auto">
        <table className="border-separate border-spacing-[2px] text-left">
          <thead>
            <tr>
              <th scope="col" className="sticky left-0 z-10 bg-papel w-52" />
              {cadenas.map((cadena) => (
                <th
                  key={cadena}
                  scope="col"
                  title={`${cadena}: lidera en ${liderazgos.get(cadena) ?? 0} categorías`}
                  className="w-10 p-0 align-bottom"
                >
                  {/* Vertical y de abajo hacia arriba: 14 nombres de cadena en
                      horizontal no entran, y abreviarlos los volvia adivinanzas
                      ("Carrefour." podia ser Express o Maxi). */}
                  <span className="inline-block [writing-mode:vertical-rl] rotate-180 whitespace-nowrap text-[13px] font-medium text-tinta-media pb-2">
                    {cadena}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {categorias.map((categoria) => {
              const elegida = categoria === categoriaElegida;
              return (
                <tr key={categoria}>
                  {/* leading-none en la celda, no solo en el boton: la caja de linea del
                      th usaba el interlineado heredado y estiraba cada fila de 14 a 24px,
                      lo que convertia la grilla en una lista. */}
                  <th scope="row" className="sticky left-0 z-10 bg-papel pr-3 font-normal leading-none">
                    <button
                      onClick={() => onElegir(categoria)}
                      className={[
                        "block w-full text-left text-[14px] leading-none truncate transition-colors",
                        elegida ? "text-tinta font-medium" : "text-tinta-media hover:text-tinta",
                      ].join(" ")}
                    >
                      {nombreCategoria(categoria)}
                    </button>
                  </th>
                  {cadenas.map((cadena) => {
                    const celda = porCelda.get(`${categoria}|${cadena}`);
                    return (
                      <td key={cadena} className="p-0">
                        <button
                          onClick={() => onElegir(categoria)}
                          aria-label={
                            celda
                              ? `${cadena} en ${nombreCategoria(categoria)}: ${celda.pct_gana_cuando_compite}% de los productos que ofrece`
                              : `${cadena} no compite en ${nombreCategoria(categoria)}`
                          }
                          title={
                            celda
                              ? `${nombreCategoria(categoria)} · ${cadena}: más barata en ${celda.pct_gana_cuando_compite}% de los ${celda.productos_ofrecidos} productos comparables que ofrece`
                              : `${nombreCategoria(categoria)} · ${cadena}: menos de 20 productos comparables, no se mide`
                          }
                          className={[
                            "block w-full h-5 rounded-[2px] transition-opacity hover:opacity-70",
                            celda ? paso(celda.pct_gana_cuando_compite) : "bg-papel-hundido",
                            elegida ? "" : "opacity-90",
                          ].join(" ")}
                        />
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </figure>
  );
}

export default MapaDelMercado;
