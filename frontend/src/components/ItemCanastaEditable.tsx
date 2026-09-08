import type { ItemCanastaIA } from "../types";
import { GAMAS } from "../utils/canastaGuardada";

const ETIQUETA_GAMA: Record<string, string> = {
  economico: "Economico",
  medio: "Medio",
  premium: "Premium",
};

/*
  El paso depende de la unidad: sumar de a 1 gramo en una categoria que se mide
  en cientos de gramos obliga a 100 clicks, y sumar de a 100 huevos es absurdo.
*/
function pasoSegunUnidad(unidad: string): number {
  const normalizada = unidad.trim().toLowerCase();
  if (normalizada === "g" || normalizada === "cc" || normalizada === "ml") return 100;
  return 1;
}

type Props = {
  item: ItemCanastaIA;
  onCambiarCantidad: (categoria: string, cantidad: number) => void;
  onCambiarGama: (categoria: string, gama: string) => void;
  onQuitar: (categoria: string) => void;
};

function ItemCanastaEditable({ item, onCambiarCantidad, onCambiarGama, onQuitar }: Props) {
  const paso = pasoSegunUnidad(item.unidad);

  return (
    <div className="bg-papel rounded-xl border border-linea p-4">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0">
          <p className="font-semibold text-tinta">{item.categoria}</p>
          {item.razon && <p className="text-xs text-tinta-suave mt-0.5">{item.razon}</p>}
        </div>
        <button
          onClick={() => onQuitar(item.categoria)}
          aria-label={`Quitar ${item.categoria}`}
          className="shrink-0 text-tinta-suave hover:text-alerta text-sm px-2 py-1 rounded-md hover:bg-alerta-tenue transition-colors"
        >
          Quitar
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
        <div className="flex items-center gap-2">
          <span className="text-xs text-tinta-suave w-14">Cantidad</span>
          <div className="flex items-center rounded-lg border border-linea overflow-hidden">
            <button
              onClick={() => onCambiarCantidad(item.categoria, item.cantidad - paso)}
              disabled={item.cantidad - paso <= 0}
              aria-label="Reducir cantidad"
              className="px-2.5 py-1.5 text-tinta-media hover:bg-papel-hundido disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
            >
              −
            </button>
            <input
              type="number"
              value={item.cantidad}
              min={0}
              step={paso}
              onChange={(e) => onCambiarCantidad(item.categoria, Number(e.target.value))}
              aria-label={`Cantidad de ${item.categoria} en ${item.unidad}`}
              className="numero w-20 text-center text-sm py-1.5 border-x border-linea focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
            <button
              onClick={() => onCambiarCantidad(item.categoria, item.cantidad + paso)}
              aria-label="Aumentar cantidad"
              className="px-2.5 py-1.5 text-tinta-media hover:bg-papel-hundido transition-colors"
            >
              +
            </button>
          </div>
          <span className="text-xs text-tinta-suave">{item.unidad} / mes</span>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-tinta-suave">Gama</span>
          <div
            role="group"
            aria-label={`Gama de ${item.categoria}`}
            className="inline-flex rounded-lg border border-linea bg-papel-hundido p-0.5"
          >
            {GAMAS.map((gama) => (
              <button
                key={gama}
                onClick={() => onCambiarGama(item.categoria, gama)}
                aria-pressed={item.gama === gama}
                className={[
                  "px-2.5 py-1 text-xs rounded-md transition-colors",
                  item.gama === gama
                    ? "bg-papel text-tinta font-semibold shadow-sm"
                    : "text-tinta-suave hover:text-tinta-media",
                ].join(" ")}
              >
                {ETIQUETA_GAMA[gama]}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default ItemCanastaEditable;
