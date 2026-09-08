import { useMemo, useState } from "react";

const VISIBLES_AL_INICIO = 12;

/*
  Las categorias salen de las promos que ya estan cargadas, no de una consulta
  aparte: el endpoint del mapa ya devuelve la categoria de cada fila, asi que
  contarlas en el cliente no cuesta nada y garantiza que los numeros coincidan
  con lo que el usuario tiene en pantalla. Filtrar tampoco vuelve a pedir datos.
*/
type ConCategoria = { categoria: string | null };

type Props<T extends ConCategoria> = {
  promos: T[];
  elegida: string | null;
  onElegir: (categoria: string | null) => void;
};

function FiltroCategorias<T extends ConCategoria>({ promos, elegida, onElegir }: Props<T>) {
  const [verTodas, setVerTodas] = useState(false);

  const conteos = useMemo(() => {
    const mapa = new Map<string, number>();
    for (const promo of promos) {
      if (!promo.categoria) continue;
      mapa.set(promo.categoria, (mapa.get(promo.categoria) ?? 0) + 1);
    }
    return [...mapa.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  }, [promos]);

  if (conteos.length === 0) return null;

  const mostradas = verTodas ? conteos : conteos.slice(0, VISIBLES_AL_INICIO);

  return (
    <nav aria-label="Filtrar por categoria" className="text-sm">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-tinta-suave mb-3">
        Categorias
      </h2>

      <ul className="space-y-0.5">
        <li>
          <BotonCategoria
            nombre="Todas"
            cantidad={promos.length}
            activa={elegida === null}
            onClick={() => onElegir(null)}
          />
        </li>
        {mostradas.map(([categoria, cantidad]) => (
          <li key={categoria}>
            <BotonCategoria
              nombre={categoria}
              cantidad={cantidad}
              activa={elegida === categoria}
              onClick={() => onElegir(elegida === categoria ? null : categoria)}
            />
          </li>
        ))}
      </ul>

      {conteos.length > VISIBLES_AL_INICIO && (
        <button
          onClick={() => setVerTodas(!verTodas)}
          className="mt-2 text-xs text-ahorro hover:text-ahorro-hover font-medium"
        >
          {verTodas ? "Ver menos" : `Ver las ${conteos.length} categorias`}
        </button>
      )}
    </nav>
  );
}

function BotonCategoria({
  nombre,
  cantidad,
  activa,
  onClick,
}: {
  nombre: string;
  cantidad: number;
  activa: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={activa}
      className={[
        "w-full flex items-baseline justify-between gap-2 rounded-lg px-2.5 py-1.5 text-left transition-colors",
        activa
          ? "bg-ahorro-tenue text-ahorro font-semibold"
          : "text-tinta-media hover:bg-papel-hundido hover:text-tinta",
      ].join(" ")}
    >
      <span className="truncate">{nombre}</span>
      <span className={["numero text-xs shrink-0", activa ? "text-ahorro" : "text-tinta-suave"].join(" ")}>
        {cantidad}
      </span>
    </button>
  );
}

export default FiltroCategorias;
