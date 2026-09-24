import { useState } from "react";
import { obtenerComposicionCanasta } from "../api/client";
import type { ItemCanastaIA } from "../types";

/*
  Adultos equivalentes por persona, del ejemplo de hogar del INDEC ("Valorizacion
  mensual de la CBA y la CBT"): un varon de 35 vale 1, una mujer de 31 vale
  0,77, un hijo de 6 vale 0,64 y una hija de 8 vale 0,68, y el hogar suma 3,09.
  Se usa el promedio de cada par para no preguntar edad y sexo de cada uno: con
  estos valores, dos adultos y dos chicos dan exactamente los 3,09 oficiales.
*/
const POR_ADULTO = (1 + 0.77) / 2;
const POR_CHICO = (0.64 + 0.68) / 2;

/** Redondeo amable para editar despues: 10 g o 10 cc, y piezas enteras. */
function redondear(cantidad: number, unidad: string): number {
  if (unidad === "unidad") return Math.max(1, Math.round(cantidad));
  return Math.max(10, Math.round(cantidad / 10) * 10);
}

function Contador({ etiqueta, valor, minimo, onCambiar }: {
  etiqueta: string;
  valor: number;
  minimo: number;
  onCambiar: (valor: number) => void;
}) {
  const boton =
    "w-8 h-8 rounded-full border border-linea text-tinta-media hover:border-linea-fuerte disabled:opacity-40 disabled:cursor-not-allowed";
  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-tinta-media w-14">{etiqueta}</span>
      <button type="button" className={boton} disabled={valor <= minimo} onClick={() => onCambiar(valor - 1)} aria-label={`Menos ${etiqueta.toLowerCase()}`}>
        −
      </button>
      <span className="numero text-sm text-tinta w-5 text-center" aria-live="polite">
        {valor}
      </span>
      <button type="button" className={boton} disabled={valor >= 10} onClick={() => onCambiar(valor + 1)} aria-label={`Mas ${etiqueta.toLowerCase()}`}>
        +
      </button>
    </div>
  );
}

/*
  Un punto de partida sin describir nada: la canasta basica del INDEC para el
  hogar que se indique, en gama economica, lista para ajustar.

  No repite la pagina de Canasta basica: aquella compara localidades con una
  canasta fija por adulto; aca se carga en Tu canasta, donde se puede sacar lo
  que no se consume, cambiar la gama y ver en que sucursales cercanas conviene
  comprarla.
*/
function EmpezarConCanastaBasica({ onCargar }: { onCargar: (items: ItemCanastaIA[]) => void }) {
  const [adultos, setAdultos] = useState(1);
  const [chicos, setChicos] = useState(0);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function cargar() {
    const factor = adultos * POR_ADULTO + chicos * POR_CHICO;
    const quienes = [
      `${adultos} ${adultos === 1 ? "adulto" : "adultos"}`,
      chicos > 0 && `${chicos} ${chicos === 1 ? "chico" : "chicos"}`,
    ]
      .filter(Boolean)
      .join(" y ");
    setCargando(true);
    setError(null);
    obtenerComposicionCanasta()
      .then((grupos) => {
        onCargar(
          grupos.flatMap((g) =>
            g.items.map((item) => ({
              categoria: item.categoria,
              cantidad: redondear(item.cantidad * factor, item.unidad),
              unidad: item.unidad,
              gama: "economico",
              razon: `Canasta basica del INDEC para ${quienes}`,
            }))
          )
        );
      })
      .catch((err) => setError(err.message))
      .finally(() => setCargando(false));
  }

  return (
    <div className="mt-6 pt-5 border-t border-linea">
      <p className="text-sm text-tinta">O empeza con la canasta basica del INDEC</p>
      <p className="text-xs text-tinta-suave mt-0.5 mb-3">
        Los alimentos basicos de un mes para tu hogar, en gama economica. Despues sacas lo que no consumis y ajustas
        el resto.
      </p>
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <Contador etiqueta="Adultos" valor={adultos} minimo={1} onCambiar={setAdultos} />
        <Contador etiqueta="Chicos" valor={chicos} minimo={0} onCambiar={setChicos} />
        <button
          type="button"
          onClick={cargar}
          disabled={cargando}
          className="text-sm font-semibold text-ahorro border border-ahorro-borde bg-ahorro-tenue px-4 py-2 rounded-lg hover:border-ahorro disabled:opacity-60 transition-colors"
        >
          {cargando ? "Cargando…" : "Cargar canasta basica"}
        </button>
      </div>
      {error && (
        <p className="mt-3 text-sm text-alerta bg-alerta-tenue border border-alerta/20 rounded-lg px-3 py-2">
          No se pudo cargar la canasta basica: {error}
        </p>
      )}
    </div>
  );
}

export default EmpezarConCanastaBasica;
