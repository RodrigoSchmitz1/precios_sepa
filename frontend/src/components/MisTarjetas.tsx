import type { PromoBancaria } from "../types";
import { entidadesDePromos, segmentosDePromos } from "../utils/promosBancarias";
import { alternar, cambiarTarjetas, useTarjetas } from "../utils/tarjetas";

/*
  "Mis tarjetas" (openspec promos-bancarias): el usuario marca sus bancos y
  billeteras entre los que tienen promos vigentes. Queda solo en el telefono.
*/
export default function MisTarjetas({ promos, onListo }: { promos: PromoBancaria[]; onListo: () => void }) {
  const tarjetas = useTarjetas();
  const entidades = entidadesDePromos(promos);
  const segmentos = segmentosDePromos(promos);
  return (
    <div className="rounded-2xl border border-linea bg-papel p-4" role="group" aria-label="Mis tarjetas">
      <p className="text-sm font-bold text-tinta">¿Con qué bancos y billeteras pagás?</p>
      <p className="text-xs text-tinta-suave mb-3">Queda guardado solo en este teléfono.</p>
      <ul className="flex flex-wrap gap-2">
        {entidades.map((e) => {
          const marcada = tarjetas.entidades.includes(e);
          return (
            <li key={e}>
              <button
                type="button"
                aria-pressed={marcada}
                onClick={() => cambiarTarjetas({ ...tarjetas, entidades: alternar(tarjetas.entidades, e) })}
                className={`rounded-full border px-3.5 min-h-10 text-sm font-semibold ${
                  marcada ? "bg-marca text-white border-marca" : "bg-papel text-tinta border-linea-fuerte"
                }`}
              >
                {marcada ? "✓ " : ""}
                {e}
              </button>
            </li>
          );
        })}
      </ul>
      {segmentos.length > 0 && (
        <>
          <p className="text-xs font-semibold text-tinta-media mt-3 mb-2">Si corresponde (opcional):</p>
          <ul className="flex flex-wrap gap-2">
            {segmentos.map((s) => {
              const marcado = tarjetas.segmentos.includes(s);
              return (
                <li key={s}>
                  <button
                    type="button"
                    aria-pressed={marcado}
                    onClick={() => cambiarTarjetas({ ...tarjetas, segmentos: alternar(tarjetas.segmentos, s) })}
                    className={`rounded-full border px-3 min-h-9 text-xs font-semibold ${
                      marcado ? "bg-tinta text-white border-tinta" : "bg-papel text-tinta-media border-linea"
                    }`}
                  >
                    {s}
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      )}
      <button type="button" onClick={onListo} className="mt-4 rounded-xl fondo-marca text-white text-sm font-bold px-4 min-h-11">
        Listo
      </button>
    </div>
  );
}
