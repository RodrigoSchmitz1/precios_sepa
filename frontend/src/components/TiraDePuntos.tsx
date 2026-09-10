import { useCallback, useState } from "react";

/*
  Tira de puntos: cada observacion es un punto sobre un eje de valores.

  Es el grafico principal del sistema visual. Muestra la distribucion completa
  y no un promedio, y deja ver de un vistazo donde queda cada extremo, que es la
  historia de casi todas las paginas: la localidad mas cara contra la mas
  barata, la cadena que cobra mas por el mismo producto.

  Los puntos que caen en el mismo lugar se apilan hacia arriba en vez de
  superponerse: con 94 localidades en un rango angosto, superpuestos se verian
  como una decena.

  Color: gris para el contexto, verde para el extremo barato, terracota para el
  caro. Nunca es la unica pista: los extremos llevan su nombre y su valor
  escritos, y cada punto tiene un title con los suyos.

  Se dibuja al ancho REAL del contenedor y no con un viewBox fijo que el
  navegador escala: con un viewBox de 680 en un celular de 375 todo quedaba a la
  mitad, y los rotulos de 12px se leian a 6. El ancho se mide al montar el
  contenedor, y un ResizeObserver lo actualiza si cambia despues. Solo con el
  observador no alcanzaba: su primer aviso llega recien cuando el navegador
  dibuja, y hasta entonces el grafico quedaba al ancho por defecto.
*/

export type Punto = {
  id: string;
  valor: number;
  nombre: string;
};

type Props = {
  puntos: Punto[];
  formatear: (valor: number) => string;
  /** Resumen para lectores de pantalla: que muestra el grafico. */
  descripcion: string;
  /** Punto a resaltar ademas de los extremos (por ejemplo, lo que se busco). */
  elegido?: string;
};

type Ancla = "start" | "end";

const MARGEN = 12;
const RADIO = 5;
const PASO = RADIO * 2 + 1;
const ALTO_FILA_ROTULO = 34;
const ALTO_EJE = 24;
const ANCHO_MINIMO = 240;
// Ancho estimado por caracter de los rotulos (13px y 12px). Alcanza para
// decidir si dos rotulos se pisan; no hace falta medir el texto real.
const PX_POR_LETRA_NOMBRE = 7.5;
const PX_POR_LETRA_VALOR = 7;

/** Marcas redondas del eje: 1, 2 o 5 por potencia de diez, buscando unas
 *  `divisiones`. Con 4 fijas, un rango de $3.100 a $5.400 saltaba de a $1.000
 *  y el eje quedaba con dos marcas. */
function marcasDelEje(minimo: number, maximo: number, divisiones: number): number[] {
  const rango = maximo - minimo;
  if (rango <= 0) return [minimo];
  const bruto = rango / divisiones;
  const potencia = 10 ** Math.floor(Math.log10(bruto));
  const paso = [1, 2, 5, 10].map((m) => m * potencia).find((p) => p >= bruto) ?? bruto;
  const marcas: number[] = [];
  for (let v = Math.ceil(minimo / paso) * paso; v <= maximo; v += paso) marcas.push(v);
  return marcas;
}

function TiraDePuntos({ puntos, formatear, descripcion, elegido }: Props) {
  const [ancho, setAncho] = useState(680);

  // Ref de callback estable: React la llama al montar el contenedor y ejecuta la
  // funcion que devuelve al desmontarlo.
  const medir = useCallback((elemento: HTMLDivElement) => {
    const actualizar = (valor: number) => setAncho(Math.max(ANCHO_MINIMO, Math.round(valor)));
    actualizar(elemento.getBoundingClientRect().width);
    const observador = new ResizeObserver(([entrada]) => actualizar(entrada.contentRect.width));
    observador.observe(elemento);
    return () => observador.disconnect();
  }, []);

  if (puntos.length === 0) return <div ref={medir} />;

  const ordenados = [...puntos].sort((a, b) => a.valor - b.valor);
  const minimo = ordenados[0].valor;
  const maximo = ordenados[ordenados.length - 1].valor;
  // Con un solo valor el eje no tiene ancho: se abre un 5% a cada lado.
  const holgura = maximo > minimo ? 0 : Math.max(Math.abs(minimo) * 0.05, 1);
  const desde = minimo - holgura;
  const hasta = maximo + holgura;
  const x = (v: number) => MARGEN + RADIO + ((v - desde) / (hasta - desde)) * (ancho - 2 * (MARGEN + RADIO));

  const pila = new Map<number, number>();
  const ubicados = ordenados.map((p) => {
    const columna = Math.round(x(p.valor) / PASO);
    const nivel = pila.get(columna) ?? 0;
    pila.set(columna, nivel + 1);
    return { ...p, cx: x(p.valor), nivel };
  });
  const niveles = Math.max(...pila.values());

  const barato = ubicados[0];
  const caro = ubicados[ubicados.length - 1];
  const hayDosExtremos = caro.valor > barato.valor;

  // Rotulos de los extremos. Cada uno se ancla hacia afuera si entra, y si no
  // hacia adentro. Si los dos se pisan, el del caro baja una fila: pasa en
  // pantallas angostas con nombres de cadena largos.
  const anchoRotulo = (p: Punto) =>
    Math.max(p.nombre.length * PX_POR_LETRA_NOMBRE, formatear(p.valor).length * PX_POR_LETRA_VALOR);
  const anclaBarato: Ancla = barato.cx + anchoRotulo(barato) <= ancho - MARGEN ? "start" : "end";
  const anclaCaro: Ancla = caro.cx - anchoRotulo(caro) >= MARGEN ? "end" : "start";
  const finBarato = anclaBarato === "start" ? barato.cx + anchoRotulo(barato) : barato.cx;
  const inicioCaro = anclaCaro === "end" ? caro.cx - anchoRotulo(caro) : caro.cx;
  const encimados = hayDosExtremos && finBarato + 12 > inicioCaro;
  const rotulos: { p: (typeof ubicados)[number]; ancla: Ancla; fila: number }[] = hayDosExtremos
    ? [
        { p: barato, ancla: anclaBarato, fila: 0 },
        { p: caro, ancla: anclaCaro, fila: encimados ? 1 : 0 },
      ]
    : [];

  const altoRotulos = hayDosExtremos ? (encimados ? 2 : 1) * ALTO_FILA_ROTULO + 6 : 6;
  const base = altoRotulos + niveles * PASO;
  const alto = base + ALTO_EJE;

  const tono = (p: (typeof ubicados)[number]) => {
    if (p.id === elegido) return "fill-tinta";
    if (hayDosExtremos && p.valor === barato.valor) return "fill-dato-verde";
    if (hayDosExtremos && p.valor === caro.valor) return "fill-alerta";
    return "fill-tinta-suave/35";
  };

  return (
    <div ref={medir}>
      <svg
        width={ancho}
        height={alto}
        viewBox={`0 0 ${ancho} ${alto}`}
        className="block max-w-full"
        role="img"
        aria-label={descripcion}
      >
        <line x1={MARGEN} x2={ancho - MARGEN} y1={base} y2={base} className="stroke-linea-fuerte" />

        {marcasDelEje(desde, hasta, ancho < 480 ? 3 : 5).map((m) => (
          <text key={m} x={x(m)} y={base + 17} textAnchor="middle" className="fill-tinta-suave text-[11px] numero">
            {formatear(m)}
          </text>
        ))}

        {ubicados.map((p) => (
          <circle
            key={p.id}
            cx={p.cx}
            cy={base - RADIO - 1 - p.nivel * PASO}
            r={p.id === elegido || (hayDosExtremos && (p === barato || p === caro)) ? RADIO + 1.5 : RADIO}
            className={tono(p)}
          >
            <title>{`${p.nombre}: ${formatear(p.valor)}`}</title>
          </circle>
        ))}

        {rotulos.map(({ p, ancla, fila }) => {
          const arriba = fila * ALTO_FILA_ROTULO;
          return (
            <g key={`rotulo-${p.id}`}>
              <line
                x1={p.cx}
                x2={p.cx}
                y1={arriba + ALTO_FILA_ROTULO}
                y2={base - RADIO * 2 - 3 - p.nivel * PASO}
                className="stroke-linea-fuerte"
              />
              <text x={p.cx} y={arriba + 14} textAnchor={ancla} className="fill-tinta text-[13px] font-medium">
                {p.nombre}
              </text>
              <text x={p.cx} y={arriba + 29} textAnchor={ancla} className="fill-tinta-media text-[12px] numero">
                {formatear(p.valor)}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

export default TiraDePuntos;
