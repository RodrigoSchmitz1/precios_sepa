import type { QuienGana } from "../types";

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

const PASOS = ["bg-escala-1", "bg-escala-2", "bg-escala-3", "bg-escala-4", "bg-escala-5"];

type Props = {
  filas: QuienGana[];
  categoriaElegida: string;
  onElegir: (categoria: string) => void;
};

function MapaDelMercado({ filas, categoriaElegida, onElegir }: Props) {
  if (filas.length === 0) return null;

  const categorias = [...new Set(filas.map((f) => f.categoria))].sort((a, b) => a.localeCompare(b, "es"));

  // Lider de cada categoria, para ordenar las cadenas por liderazgos.
  const liderazgos = new Map<string, number>();
  for (const categoria of categorias) {
    const deLaCategoria = filas.filter((f) => f.categoria === categoria);
    const maximo = Math.max(...deLaCategoria.map((f) => f.pct_gana_cuando_compite));
    for (const fila of deLaCategoria) {
      if (fila.pct_gana_cuando_compite === maximo) {
        liderazgos.set(fila.cadena, (liderazgos.get(fila.cadena) ?? 0) + 1);
      }
    }
  }

  const cadenas = [...new Set(filas.map((f) => f.cadena))].sort(
    (a, b) => (liderazgos.get(b) ?? 0) - (liderazgos.get(a) ?? 0) || a.localeCompare(b, "es")
  );

  const porCelda = new Map(filas.map((f) => [`${f.categoria}|${f.cadena}`, f]));
  const maximo = Math.max(...filas.map((f) => f.pct_gana_cuando_compite), 1);
  const paso = (pct: number) => PASOS[Math.min(PASOS.length - 1, Math.floor((pct / maximo) * PASOS.length))];

  return (
    <figure className="m-0">
      <figcaption className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 pb-2 border-b border-linea-fuerte">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-tinta-suave">
          El mapa del mercado
        </h2>
        <span className="flex items-center gap-1.5 text-[11px] text-tinta-suave">
          <span className="numero">0%</span>
          {PASOS.map((clase) => (
            <span key={clase} className={`w-4 h-2.5 rounded-[2px] ${clase}`} aria-hidden="true" />
          ))}
          <span className="numero">{Math.round(maximo)}%</span>
          <span className="text-linea-fuerte">·</span>
          <span className="w-4 h-2.5 rounded-[2px] bg-papel-hundido inline-block" aria-hidden="true" /> no compite
        </span>
      </figcaption>

      {/* En pantallas angostas la grilla scrollea sola, con la columna de
          categorias fija: partirla en dos lineas la volveria ilegible. */}
      <div className="overflow-x-auto -mx-5 px-5 sm:mx-0 sm:px-0">
        <table className="border-separate border-spacing-[2px] text-left">
          <thead>
            <tr>
              <th scope="col" className="sticky left-0 z-10 bg-lienzo w-36 sm:w-44" />
              {cadenas.map((cadena) => (
                <th
                  key={cadena}
                  scope="col"
                  title={`${cadena}: lidera en ${liderazgos.get(cadena) ?? 0} categorias`}
                  className="w-7 p-0 align-bottom"
                >
                  {/* Vertical y de abajo hacia arriba: 14 nombres de cadena en
                      horizontal no entran, y abreviarlos los volvia adivinanzas
                      ("Carrefour." podia ser Express o Maxi). */}
                  <span className="[writing-mode:vertical-rl] rotate-180 whitespace-nowrap text-[10px] font-medium text-tinta-media pb-1.5">
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
                  <th scope="row" className="sticky left-0 z-10 bg-lienzo pr-3 font-normal leading-none">
                    <button
                      onClick={() => onElegir(categoria)}
                      className={[
                        "block w-full text-left text-[11px] leading-none truncate transition-colors",
                        elegida ? "text-tinta font-medium" : "text-tinta-media hover:text-tinta",
                      ].join(" ")}
                    >
                      {categoria}
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
                              ? `${cadena} en ${categoria}: ${celda.pct_gana_cuando_compite}% de los productos que ofrece`
                              : `${cadena} no compite en ${categoria}`
                          }
                          title={
                            celda
                              ? `${categoria} · ${cadena}: mas barata en ${celda.pct_gana_cuando_compite}% de los ${celda.productos_ofrecidos} productos comparables que ofrece`
                              : `${categoria} · ${cadena}: menos de 20 productos comparables, no se mide`
                          }
                          className={[
                            "block w-full h-3 rounded-[2px] transition-opacity hover:opacity-70",
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
