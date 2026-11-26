import type { TramoSemana, FilaResumen } from "../../utils/resumenGastos";
import { colorDeCadena, inicialDeCadena } from "../../utils/colorDeCadena";
import { formatearPesos, porcentajeEntero } from "../../utils/formato";

/*
  Los graficos de Mis gastos (openspec mis-gastos-como-app), en SVG y CSS
  propios: una dona por categoria, barras por semana y el gasto por super.
*/

const COLORES_DONA = ["var(--color-marca)", "var(--color-celeste)", "var(--color-dato-verde)", "var(--color-dato-ocre)", "var(--color-dato-ciruela)"];
const COLOR_OTRAS = "var(--color-linea-fuerte)";
const PORCIONES = 5;

export function DonaCategorias({ filas, total }: { filas: FilaResumen[]; total: number }) {
  if (total <= 0 || filas.length === 0) return null;
  const primeras = filas.slice(0, PORCIONES);
  const resto = filas.slice(PORCIONES).reduce((s, f) => s + f.total, 0);
  const porciones = [
    ...primeras.map((f, i) => ({ ...f, color: COLORES_DONA[i] })),
    ...(resto > 0 ? [{ nombre: "Otras", total: resto, color: COLOR_OTRAS }] : []),
  ];
  // Circunferencia 100: cada porcion ocupa su porcentaje del trazo.
  let acumulado = 0;
  return (
    <div className="flex items-center gap-4">
      <svg viewBox="0 0 42 42" className="w-28 h-28 shrink-0 -rotate-90" role="img" aria-label="Gasto por categoría">
        <circle cx="21" cy="21" r="15.9155" fill="none" stroke="var(--color-papel-hundido)" strokeWidth="7" />
        {porciones.map((p) => {
          const largo = (p.total / total) * 100;
          const circulo = (
            <circle
              key={p.nombre}
              cx="21"
              cy="21"
              r="15.9155"
              fill="none"
              stroke={p.color}
              strokeWidth="7"
              strokeDasharray={`${largo} ${100 - largo}`}
              strokeDashoffset={-acumulado}
            />
          );
          acumulado += largo;
          return circulo;
        })}
      </svg>
      <ul className="flex-1 min-w-0 grid gap-1.5 text-sm">
        {porciones.map((p) => (
          <li key={p.nombre} className="flex items-center gap-2">
            <span aria-hidden="true" className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: p.color }} />
            <span className="flex-1 min-w-0 truncate text-tinta-media">{p.nombre}</span>
            <span className="font-bold text-tinta numero">{porcentajeEntero(p.total / total)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function SemanaASemana({ tramos, tramoDeHoy }: { tramos: TramoSemana[]; tramoDeHoy: number | null }) {
  const maximo = Math.max(...tramos.map((t) => t.total), 0);
  return (
    <div className="flex items-end gap-2.5 h-32" role="list" aria-label="Gasto por semana">
      {tramos.map((t, i) => (
        <div key={t.etiqueta} role="listitem" className="flex-1 h-full flex flex-col items-center justify-end gap-1.5">
          <span
            aria-hidden="true"
            className={`w-full rounded-t-lg rounded-b ${i === tramoDeHoy ? "bg-celeste" : "bg-marca"} ${t.total > 0 ? "" : "opacity-20"}`}
            style={{ height: `${maximo > 0 ? Math.max(4, (t.total / maximo) * 78) : 4}%` }}
          />
          <span className="text-[11px] text-tinta-suave">{t.etiqueta}</span>
          <span className="sr-only">{formatearPesos(t.total)}</span>
        </div>
      ))}
    </div>
  );
}

export function InicialDeCadena({ cadena }: { cadena: string }) {
  return (
    <span
      aria-hidden="true"
      className="w-10 h-10 rounded-xl grid place-items-center text-white font-extrabold text-sm shrink-0"
      style={{ background: colorDeCadena(cadena) }}
    >
      {inicialDeCadena(cadena)}
    </span>
  );
}

export function PorSuper({ filas, total, compras }: { filas: FilaResumen[]; total: number; compras: Map<string, number> }) {
  return (
    <ul className="grid gap-3">
      {filas.map((f) => {
        const n = compras.get(f.nombre) ?? 0;
        const parte = total > 0 ? f.total / total : 0;
        return (
          <li key={f.nombre} className="flex items-center gap-3">
            <InicialDeCadena cadena={f.nombre} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-tinta truncate">{f.nombre}</p>
              <p className="text-xs text-tinta-suave">
                {n} {n === 1 ? "compra" : "compras"}
              </p>
              <div aria-hidden="true" className="mt-1 h-1.5 rounded-full bg-papel-hundido overflow-hidden">
                <div className="h-full rounded-full" style={{ width: `${Math.max(2, parte * 100)}%`, background: colorDeCadena(f.nombre) }} />
              </div>
            </div>
            <div className="text-right shrink-0">
              <p className="text-sm font-bold text-tinta numero">{formatearPesos(f.total)}</p>
              <p className="text-xs font-semibold text-tinta-suave numero">{porcentajeEntero(parte)}</p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
