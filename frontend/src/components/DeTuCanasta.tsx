import { useEffect, useState } from "react";
import { obtenerSugeridos } from "../api/client";
import { formatearPesos, formatearTamano, precioPorUnidad } from "../utils/formato";
import { MAXIMO_UNIDADES } from "../utils/lista";
import { nombreCategoria } from "../utils/nombres";
import type { ItemCanastaIA, ItemLista, ProductoSugerido } from "../types";

/*
  De tu canasta a tu lista (2026-10-08).

  Tu canasta cotiza categorias ("yerba, 2 kg por mes, gama media") y Tu lista
  productos exactos. Las dos preguntas se encadenan: quien ya armo la canasta
  sabe QUE compra; aca elige DE QUE MARCA, con un toque por categoria, y Tu
  lista le dice en que cadena le sale mas barata esa compra.

  Las opciones de cada categoria son las mas comunes (las que tienen precio en
  mas sucursales): son las que compra la mayoria y las que mas se comparan. La
  que no esta se busca arriba, y cuenta igual como elegida.

  La cantidad se lleva: 2 kg de yerba por mes en paquetes de 500 g son 4.
*/

type Props = {
  items: ItemCanastaIA[];
  lista: ItemLista[];
  onAgregar: (p: ProductoSugerido, cantidad: number) => void;
  onVer: (id: string) => void;
  nombrar: (p: ProductoSugerido) => string;
};

const OPCIONES = 3;
const MAS_OPCIONES = 9;
const FILAS_VISIBLES = 6;

/** "$3.690 el kg": compara un paquete de 500 g con uno de 1 kg. */
function porKiloOLitro(p: ProductoSugerido): string | null {
  if (!p.cantidad_normalizada || (p.unidad_normalizada !== "g" && p.unidad_normalizada !== "cc")) return null;
  const { texto, unidad } = precioPorUnidad(p.precio_mas_bajo / p.cantidad_normalizada, p.unidad_normalizada);
  return `${texto} el ${unidad}`;
}

/** Cuantos envases cubren la cantidad del mes. 1 si las unidades no se pueden comparar. */
function unidadesParaElMes(item: ItemCanastaIA, p: ProductoSugerido): number {
  if (!p.cantidad_normalizada || p.unidad_normalizada !== item.unidad) return 1;
  return Math.min(Math.max(Math.ceil(item.cantidad / p.cantidad_normalizada - 0.05), 1), MAXIMO_UNIDADES);
}

function DeTuCanasta({ items, lista, onAgregar, onVer, nombrar }: Props) {
  const categorias = [...new Set(items.map((i) => i.categoria))];
  const clave = JSON.stringify(categorias);
  const [sugeridos, setSugeridos] = useState<{
    clave: string;
    datos?: Record<string, ProductoSugerido[]>;
    error?: string;
  }>();
  const [ampliadas, setAmpliadas] = useState<Record<string, ProductoSugerido[]>>({});
  const [verTodas, setVerTodas] = useState(false);
  // Una categoria elegida se pliega a una linea, y la pagina se acorta a medida
  // que se avanza. "Cambiar" la vuelve a abrir.
  const [abiertas, setAbiertas] = useState<Set<string>>(new Set());
  const abrir = (categoria: string) => setAbiertas((previas) => new Set(previas).add(categoria));

  useEffect(() => {
    let cancelado = false;
    obtenerSugeridos(JSON.parse(clave) as string[], OPCIONES)
      .then((datos) => !cancelado && setSugeridos({ clave, datos }))
      .catch((err) => !cancelado && setSugeridos({ clave, error: err.message }));
    return () => {
      cancelado = true;
    };
  }, [clave]);

  const ampliar = (categoria: string) =>
    obtenerSugeridos([categoria], MAS_OPCIONES)
      .then((datos) =>
        setAmpliadas((previas) => ({
          ...previas,
          [categoria]: datos[categoria] ?? [],
        })),
      )
      .catch(() => {
        /* se quedan las tres que ya habia */
      });

  const datos = sugeridos?.clave === clave ? sugeridos.datos : undefined;
  const elegidaDe = (categoria: string) => lista.find((i) => i.categoria === categoria);
  const elegidas = categorias.filter((c) => elegidaDe(c)).length;
  // En el orden de la canasta, fijo: si la fila elegida se fuera al final, la
  // pagina saltaria debajo del dedo en cada toque.
  const ordenadas = items.filter((item, i, todos) => todos.findIndex((x) => x.categoria === item.categoria) === i);
  const visibles = verTodas ? ordenadas : ordenadas.slice(0, FILAS_VISIBLES);

  return (
    <section aria-labelledby="titulo-de-tu-canasta" className="mb-10">
      <div className="flex items-baseline justify-between gap-4 mb-1">
        <h2 id="titulo-de-tu-canasta" className="font-display text-2xl text-tinta">
          De tu canasta
        </h2>
        <p className="text-xs text-tinta-suave numero shrink-0">
          {elegidas} de {categorias.length} elegidas
        </p>
      </div>
      <p className="text-sm text-tinta-media mb-3">
        Elegí la marca de cada cosa y abajo ves en qué cadena te sale más barata la compra.
      </p>
      <div className="h-1.5 bg-papel-hundido rounded-full overflow-hidden mb-5" aria-hidden="true">
        <div
          className="h-full bg-ahorro rounded-full transition-all"
          style={{
            width: `${(elegidas / Math.max(categorias.length, 1)) * 100}%`,
          }}
        />
      </div>

      {sugeridos?.error && <p className="text-sm text-alerta mb-3">{sugeridos.error}</p>}

      <ul className="space-y-3">
        {visibles.map((item) => {
          const elegida = elegidaDe(item.categoria);
          const opciones = ampliadas[item.categoria] ?? datos?.[item.categoria];
          const tamano = formatearTamano(item.cantidad, item.unidad as "g" | "cc" | "unidad");
          return (
            <li
              key={item.categoria}
              className={`rounded-2xl border p-3 sm:p-4 ${elegida ? "border-ahorro-borde bg-ahorro-tenue/40" : "border-linea bg-papel"}`}
            >
              <div className="flex items-baseline justify-between gap-3 mb-2">
                <h3 className="text-sm font-semibold text-tinta">
                  {elegida && <span className="text-ahorro mr-1">✓</span>}
                  {nombreCategoria(item.categoria)}
                </h3>
                {tamano && <span className="text-xs text-tinta-suave shrink-0">{tamano} por mes</span>}
              </div>

              {elegida && !abiertas.has(item.categoria) ? (
                <div className="flex items-center justify-between gap-3">
                  <button
                    onClick={() => onVer(elegida.id_producto)}
                    className="min-w-0 text-left text-sm text-tinta truncate hover:text-ahorro"
                  >
                    {elegida.nombre}
                    {elegida.cantidad > 1 && <span className="text-tinta-suave numero"> × {elegida.cantidad}</span>}
                  </button>
                  <button
                    onClick={() => abrir(item.categoria)}
                    className="shrink-0 text-xs text-tinta-media underline underline-offset-2 hover:text-tinta"
                  >
                    Cambiar
                  </button>
                </div>
              ) : (
                <>
                  {opciones === undefined && !sugeridos?.error && (
                    <div className="grid sm:grid-cols-3 gap-2" aria-hidden="true">
                      {[0, 1, 2].map((n) => (
                        <div key={n} className="h-[4.5rem] rounded-xl bg-papel-hundido animate-pulse" />
                      ))}
                    </div>
                  )}
                  {opciones && opciones.length === 0 && (
                    <p className="text-xs text-tinta-suave">
                      Hoy no hay productos de esta categoría con precio en dos o más cadenas.
                    </p>
                  )}
                  {opciones && opciones.length > 0 && (
                    <div className="grid gap-2 sm:grid-cols-3">
                      {opciones.map((p) => {
                        const esta = lista.some((i) => i.id_producto === p.id_producto);
                        const unidades = unidadesParaElMes(item, p);
                        const referencia = porKiloOLitro(p);
                        return (
                          <button
                            key={p.id_producto}
                            onClick={() => (esta ? onVer(p.id_producto) : onAgregar(p, unidades))}
                            aria-pressed={esta}
                            className={`flex flex-col justify-between text-left rounded-xl border px-3 py-2 transition-colors ${
                              esta
                                ? "border-ahorro bg-papel"
                                : "border-linea bg-papel hover:border-ahorro-borde hover:bg-ahorro-tenue/30"
                            }`}
                          >
                            <span className="block text-sm text-tinta leading-snug line-clamp-2">{nombrar(p)}</span>
                            <span className="flex items-center justify-between gap-2 mt-1">
                              <span className="numero leading-tight text-sm text-tinta">
                                desde {formatearPesos(p.precio_mas_bajo)}
                                {referencia && <span className="text-xs text-tinta-suave"> · {referencia}</span>}
                              </span>
                              <span
                                className={`shrink-0 text-xs font-medium rounded-full px-2.5 py-1 ${
                                  esta ? "text-ahorro" : "border border-ahorro-borde text-ahorro"
                                }`}
                              >
                                {esta ? "✓ En tu lista" : unidades > 1 ? `Sumar ${unidades}` : "Sumar"}
                              </span>
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                  {opciones && opciones.length >= OPCIONES && !ampliadas[item.categoria] && (
                    <button
                      onClick={() => ampliar(item.categoria)}
                      className="mt-2 text-xs text-tinta-media underline underline-offset-2 hover:text-tinta"
                    >
                      Más opciones
                    </button>
                  )}
                </>
              )}
            </li>
          );
        })}
      </ul>

      {ordenadas.length > FILAS_VISIBLES && (
        <button
          onClick={() => setVerTodas((v) => !v)}
          className="mt-3 text-sm text-tinta-media underline underline-offset-2 hover:text-tinta"
        >
          {verTodas ? "Ver menos" : `Ver las ${ordenadas.length - FILAS_VISIBLES} categorías restantes`}
        </button>
      )}
      <p className="mt-3 text-xs text-tinta-suave leading-relaxed">
        Las opciones son las que tienen precio en más sucursales. Si la tuya no está, buscala arriba: cuenta igual.
      </p>
    </section>
  );
}

export default DeTuCanasta;
