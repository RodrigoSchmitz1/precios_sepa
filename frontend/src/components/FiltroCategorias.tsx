import { useMemo, useState } from "react";

/*
  Filtro de dos niveles: rubro y, desplegado, sus categorias.

  Antes era una lista plana de 30 y pico de categorias ordenadas por cantidad.
  Con eso, "Textil y calzado", "Bazar y hogar", "Electro" y "Jugueteria"
  quedaban intercaladas entre Lacteos y Conservas, y no habia forma de decir
  "mostrame solo comida" sin ir tildando categoria por categoria. El rubro ya
  existia en los datos -es el agrupador natural, el mismo que usa el resto del
  proyecto- y solo faltaba exponerlo.

  Se despliega al elegirlo, como en los sitios de supermercado: el primer click
  filtra por el rubro entero y muestra que hay adentro; el segundo, sobre una
  categoria, afina. No hay un tercer nivel ni casillas multiples a proposito:
  el filtro es para descartar rapido, no para armar una consulta.

  Todo sale de las promos ya cargadas, sin una consulta aparte: el endpoint
  devuelve rubro y categoria de cada fila, asi que contar en el cliente no
  cuesta nada y garantiza que los numeros coincidan con lo que hay en pantalla.
*/

export type Seleccion = { tipo: "rubro" | "categoria"; valor: string } | null;

type ConRubro = { rubro: string | null; categoria: string | null };

type Props<T extends ConRubro> = {
  promos: T[];
  elegido: Seleccion;
  onElegir: (seleccion: Seleccion) => void;
};

const SIN_RUBRO = "Otros";

function FiltroCategorias<T extends ConRubro>({ promos, elegido, onElegir }: Props<T>) {
  // Se despliega el rubro elegido, y ademas el que el usuario haya abierto a
  // mano sin filtrar: mirar que hay adentro no deberia obligar a filtrar.
  const [abierto, setAbierto] = useState<string | null>(null);

  const rubros = useMemo(() => {
    const mapa = new Map<string, { total: number; categorias: Map<string, number> }>();
    for (const promo of promos) {
      const rubro = promo.rubro ?? SIN_RUBRO;
      const entrada = mapa.get(rubro) ?? { total: 0, categorias: new Map() };
      entrada.total += 1;
      if (promo.categoria) {
        entrada.categorias.set(promo.categoria, (entrada.categorias.get(promo.categoria) ?? 0) + 1);
      }
      mapa.set(rubro, entrada);
    }
    return [...mapa.entries()]
      .map(([nombre, { total, categorias }]) => ({
        nombre,
        total,
        categorias: [...categorias.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])),
      }))
      .sort((a, b) => b.total - a.total || a.nombre.localeCompare(b.nombre));
  }, [promos]);

  if (rubros.length === 0) return null;

  const rubroDesplegado = elegido?.tipo === "rubro" ? elegido.valor : abierto;
  const rubroDeLaCategoria =
    elegido?.tipo === "categoria"
      ? rubros.find((r) => r.categorias.some(([c]) => c === elegido.valor))?.nombre
      : undefined;

  return (
    <nav aria-label="Filtrar por rubro" className="text-sm">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-tinta-suave mb-3">Rubros</h2>

      <ul className="space-y-0.5">
        <li>
          <Boton
            nombre="Todos"
            cantidad={promos.length}
            activo={elegido === null}
            onClick={() => {
              onElegir(null);
              setAbierto(null);
            }}
          />
        </li>

        {rubros.map((rubro) => {
          const desplegado = rubroDesplegado === rubro.nombre || rubroDeLaCategoria === rubro.nombre;
          return (
            <li key={rubro.nombre}>
              <Boton
                nombre={rubro.nombre}
                cantidad={rubro.total}
                activo={elegido?.tipo === "rubro" && elegido.valor === rubro.nombre}
                expandido={rubro.categorias.length > 1 ? desplegado : undefined}
                onClick={() => {
                  const yaElegido = elegido?.tipo === "rubro" && elegido.valor === rubro.nombre;
                  onElegir(yaElegido ? null : { tipo: "rubro", valor: rubro.nombre });
                  setAbierto(yaElegido ? null : rubro.nombre);
                }}
              />

              {/* Una sola categoria no se despliega: repetiria el nombre del
                  rubro con el mismo numero al lado. */}
              {desplegado && rubro.categorias.length > 1 && (
                <ul className="ml-2.5 mt-0.5 mb-1 pl-2.5 border-l border-linea space-y-0.5">
                  {rubro.categorias.map(([categoria, cantidad]) => (
                    <li key={categoria}>
                      <Boton
                        nombre={categoria}
                        cantidad={cantidad}
                        chico
                        activo={elegido?.tipo === "categoria" && elegido.valor === categoria}
                        onClick={() =>
                          onElegir(
                            elegido?.tipo === "categoria" && elegido.valor === categoria
                              ? { tipo: "rubro", valor: rubro.nombre }
                              : { tipo: "categoria", valor: categoria }
                          )
                        }
                      />
                    </li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function Boton({
  nombre,
  cantidad,
  activo,
  onClick,
  chico,
  expandido,
}: {
  nombre: string;
  cantidad: number;
  activo: boolean;
  onClick: () => void;
  chico?: boolean;
  expandido?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={activo}
      aria-expanded={expandido}
      className={[
        "w-full flex items-baseline justify-between gap-2 rounded-lg px-2.5 py-1.5 text-left transition-colors",
        chico ? "text-xs" : "",
        activo
          ? "bg-ahorro-tenue text-ahorro font-semibold"
          : "text-tinta-media hover:bg-papel-hundido hover:text-tinta",
      ].join(" ")}
    >
      <span className="truncate">
        {/* El signo dice que hay algo adentro antes de hacer click. */}
        {expandido !== undefined && (
          <span className="inline-block w-3 text-tinta-suave">{expandido ? "−" : "+"}</span>
        )}
        {nombre}
      </span>
      <span className={["numero text-xs shrink-0", activo ? "text-ahorro" : "text-tinta-suave"].join(" ")}>
        {cantidad}
      </span>
    </button>
  );
}

export default FiltroCategorias;
