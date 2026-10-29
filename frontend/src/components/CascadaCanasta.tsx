import { formatearVariacion } from "../utils/formato";
import { nombreCategoria } from "../utils/nombres";
import { textosCascada } from "../utils/textoCascada";
import type { IncidenciaCanasta } from "../types";

/*
  Cuanto aporta cada categoria a la variacion de la canasta basica (2026-10-27).

  El ranking de abajo dice que categoria se movio mas, pero no cuanto pesa: un
  +4% en sal y un +1% en carne no se pueden comparar, porque en la canasta se
  gasta 300 veces mas en carne. Esto los pone en la misma escala, puntos de la
  canasta, y los apila: cada barra arranca donde termino la anterior y la
  ultima es la canasta entera. Es como el INDEC explica el IPC.

  Se dibujan las categorias que mas aportan y el resto se junta en una fila:
  32 barras chicas no explican nada. La paleta es la misma de la pagina (suba
  terracota, baja verde, con el signo y el sentido de la barra como segunda
  señal) y el total va en tinta, que no es un color de dato.
*/

const MOSTRADAS = 8;

type Fila = { nombre: string; incidencia: number; detalle: string; desde: number; hasta: number };

function CascadaCanasta({ datos, esElUltimo }: { datos: IncidenciaCanasta; esElUltimo: boolean }) {
  if (datos.variacion_canasta_pct === null || datos.categorias.length === 0) return null;

  // Las que mas mueven, en cualquier sentido; el resto se suma en una fila.
  const ordenadas = [...datos.categorias].sort((a, b) => Math.abs(b.incidencia_pp) - Math.abs(a.incidencia_pp));
  // Una sola de mas se muestra con su nombre: "Otras 1" no dice nada.
  const corte = ordenadas.length === MOSTRADAS + 1 ? ordenadas.length : MOSTRADAS;
  const principales = ordenadas.slice(0, corte).sort((a, b) => b.incidencia_pp - a.incidencia_pp);
  const resto = ordenadas.slice(corte);

  const filas: Fila[] = [];
  let acumulado = 0;
  const sumar = (nombre: string, incidencia: number, detalle: string) => {
    filas.push({ nombre, incidencia, detalle, desde: acumulado, hasta: acumulado + incidencia });
    acumulado += incidencia;
  };
  for (const c of principales) {
    sumar(
      nombreCategoria(c.categoria),
      c.incidencia_pp,
      `pesa ${c.peso_pct.toLocaleString("es-AR", { maximumFractionDigits: 1 })}% y varió ${formatearVariacion(c.variacion_pct)}`
    );
  }
  if (resto.length > 0) {
    sumar(
      `Otras ${resto.length}`,
      resto.reduce((s, c) => s + c.incidencia_pp, 0),
      resto.map((c) => nombreCategoria(c.categoria)).join(", ")
    );
  }

  const total = datos.variacion_canasta_pct;
  // La escala cubre de cero a lo mas lejos que llegue la cascada en cada sentido.
  const minimo = Math.min(0, ...filas.map((f) => Math.min(f.desde, f.hasta)), total);
  const maximo = Math.max(0, ...filas.map((f) => Math.max(f.desde, f.hasta)), total);
  const rango = maximo - minimo || 1;
  const x = (v: number) => ((v - minimo) / rango) * 100;
  const puntos = (v: number) => {
    // Se redondea antes de elegir el signo: -0,004 se mostraba "−0,00".
    const r = Math.round(v * 100) / 100;
    return `${r > 0 ? "+" : r < 0 ? "−" : ""}${Math.abs(r).toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const textos = textosCascada(datos, esElUltimo);

  return (
    <div className="tarjeta p-4 sm:p-6 mb-8">
      <div className="pb-3 border-b border-linea mb-3">
        <h2 className="font-display text-xl text-tinta">{textos.titulo}</h2>
        <p className="text-sm text-tinta-suave mt-1">
          Cuántos puntos aporta cada categoría, según lo que pesa en la canasta del INDEC
          {textos.periodo}. Cada barra arranca donde termina la anterior. No es el promedio de arriba: acá cada
          categoría pesa lo que se gasta en ella.
        </p>
        {textos.aviso && <p className="text-xs text-aviso mt-2">{textos.aviso}</p>}
      </div>

      <ul className="space-y-1.5">
        {filas.map((f) => {
          const sube = f.incidencia >= 0;
          return (
            <li key={f.nombre}>
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className="text-tinta-media min-w-0">
                  {f.nombre}
                  {/* Visible y no en un title: en el celular el title no se ve (auditoria 2026-10-28). */}
                  <span className="block text-[11px] text-tinta-suave leading-snug">{f.detalle}</span>
                </span>
                <span className="numero text-tinta shrink-0">{puntos(f.incidencia)} pp</span>
              </div>
              <div className="relative h-2 bg-papel-hundido rounded-full mt-0.5">
                <div className="absolute inset-y-[-2px] w-px bg-linea-fuerte" style={{ left: `${x(0)}%` }} />
                <div
                  className={["absolute inset-y-0 rounded", sube ? "bg-alerta" : "bg-dato-verde"].join(" ")}
                  style={{
                    left: `${x(Math.min(f.desde, f.hasta))}%`,
                    width: `max(${Math.abs(x(f.hasta) - x(f.desde))}%, 2px)`,
                  }}
                  role="presentation"
                />
              </div>
            </li>
          );
        })}
        <li className="pt-2 mt-2 border-t border-linea">
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="font-semibold text-tinta">{textos.etiquetaTotal}</span>
            <span className="numero font-semibold text-tinta shrink-0">{formatearVariacion(total)}</span>
          </div>
          <div className="relative h-2 bg-papel-hundido rounded-full mt-0.5">
            <div
              className="absolute inset-y-0 rounded bg-tinta-media"
              style={{ left: `${x(Math.min(0, total))}%`, width: `max(${Math.abs(x(total) - x(0))}%, 2px)` }}
              role="presentation"
            />
          </div>
        </li>
      </ul>

      <p className="text-[11px] text-tinta-suave mt-4 pt-3 border-t border-linea leading-relaxed">
        Cada categoría pesa lo que cuesta su cantidad en la canasta básica alimentaria del INDEC, al precio del cierre
        del mes anterior. Su aporte es ese peso por su variación, y los aportes suman la variación de la canasta.
      </p>
    </div>
  );
}

export default CascadaCanasta;
