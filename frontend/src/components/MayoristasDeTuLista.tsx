import type { ResultadoLista } from "../types";
import { formatearPesos } from "../utils/formato";

/*
  Tu lista en los mayoristas cerca de la zona (openspec sumar-mayoristas).

  Aparte y al final: el titular, el ahorro y los totales de arriba siguen siendo
  entre súper. Acá cada mayorista cerca dice cuántos productos de la lista tiene
  y cuánto suman por unidad comprando el bulto, que es otra forma de comprar.
*/
export default function MayoristasDeTuLista({ filas }: { filas: NonNullable<ResultadoLista["mayoristas"]> }) {
  if (filas.length === 0) return null;
  return (
    <section className="mb-5" aria-labelledby="titulo-mayoristas-lista">
      <h3 id="titulo-mayoristas-lista" className="text-base font-bold text-tinta mb-1">
        En mayoristas cerca
      </h3>
      <p className="text-xs text-tinta-suave mb-2">
        Por unidad comprando el bulto entero. No entra en la comparación de arriba.
      </p>
      <ul className="divide-y divide-linea">
        {filas.map((f) => (
          <li key={f.cadena} className="py-1.5 flex items-baseline justify-between gap-3 text-sm text-tinta-media">
            <span className="truncate">{f.cadena}</span>
            <span className="numero shrink-0">
              {formatearPesos(f.total)}{" "}
              <span className="text-xs text-tinta-suave">
                por {f.productos_con_precio} de {f.productos}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
