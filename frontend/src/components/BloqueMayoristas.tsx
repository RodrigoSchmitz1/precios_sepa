import type { PrecioMayorista } from "../types";
import { formatearPesos } from "../utils/formato";
import { diferenciaContraSuper, textoBulto } from "../utils/mayoristas";
import { nombreCadena } from "../utils/nombres";

/*
  Los mayoristas en el detalle de un producto (openspec sumar-mayoristas).

  Van aparte de la lista de precios de los súper y debajo de ella: el precio es
  por unidad comprando el bulto entero, no la compra de una persona. Por eso no
  cuentan para la más barata, la diferencia ni Tu lista, y cada uno dice cuánto
  sale contra el súper más barato (el de la zona si hay zona).
*/

/** " · mayorista cerca", o solo " · cerca" si el nombre ya lo dice
 *  ("La Agrícola Regional (mayorista)"). */
function etiquetaFila(cadena: string, cerca: boolean): string {
  if (/mayorista/i.test(cadena)) return cerca ? " · cerca" : "";
  return cerca ? " · mayorista cerca" : " · mayorista";
}

export default function BloqueMayoristas({
  mayoristas,
  precioSuper,
  deZona = false,
  cercanos = null,
}: {
  mayoristas: PrecioMayorista[] | undefined;
  /** El súper más barato del producto: de la zona si hay zona, si no del país. */
  precioSuper: number;
  deZona?: boolean;
  /** Los mayoristas a menos de 3 km de la zona (nombres de la API). */
  cercanos?: string[] | null;
}) {
  // Solo los precios creíbles: uno que contradice a los súper es un dato mal
  // cargado (Basualdo publica ~10% así) y no ayuda a decidir dónde comprar.
  const creibles = (mayoristas ?? []).filter((m) => m.precio_creible);
  if (creibles.length === 0) return null;
  const cerca = new Set((cercanos ?? []).map(nombreCadena));
  const orden = [...creibles].sort(
    (a, b) =>
      Number(cerca.has(b.cadena)) - Number(cerca.has(a.cadena)) ||
      a.precio_mediano - b.precio_mediano ||
      a.cadena.localeCompare(b.cadena),
  );
  const contra = deZona ? "el súper más barato de tu zona" : "el súper más barato";

  return (
    <section className="mt-8" aria-labelledby="titulo-mayoristas">
      <h3 id="titulo-mayoristas" className="text-sm font-bold text-tinta mb-2">
        En mayoristas, comprando el bulto
      </h3>
      <ul className="tarjeta divide-y divide-linea">
        {orden.map((m) => (
          <li key={m.cadena} className="flex items-baseline gap-3 px-4 py-2.5">
            <span className="flex-1 min-w-0">
              <span className="block text-base text-tinta">
                {m.cadena}
                <span className="text-xs text-tinta-suave">{etiquetaFila(m.cadena, cerca.has(m.cadena))}</span>
              </span>
              <span className="block text-xs text-tinta-suave">{textoBulto(m)}</span>
              <span className={`block text-xs ${m.precio_mediano < precioSuper ? "text-ahorro" : "text-tinta-suave"}`}>
                {diferenciaContraSuper(m.precio_mediano, precioSuper)} {contra}
              </span>
            </span>
            <span className="numero text-sm text-right shrink-0 font-semibold text-tinta">
              {formatearPesos(m.precio_mediano)} c/u
            </span>
          </li>
        ))}
      </ul>
      <p className="text-xs text-tinta-suave mt-2 leading-relaxed">
        Precio por unidad comprando el bulto entero, con IVA: la mediana entre las sucursales del mayorista. No entra en la
        comparación entre súper.
      </p>
    </section>
  );
}
