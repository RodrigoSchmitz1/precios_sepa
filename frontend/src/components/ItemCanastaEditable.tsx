import { useState } from "react";
import type { ItemCanastaIA } from "../types";
import { GAMAS } from "../utils/canastaGuardada";
import { leerCantidad, mostrarCantidad } from "../utils/cantidad";
import { nombreCategoria } from "../utils/nombres";

const ETIQUETA_GAMA: Record<string, string> = {
  economico: "Económico",
  medio: "Medio",
  premium: "Premium",
};

/*
  Las cantidades se guardan en gramos o cc, que es como cotiza la API, pero se
  muestran y se editan en kilos o litros: "7000 g / mes" obligaba a hacer la
  cuenta, y nadie piensa la compra del mes en gramos. El paso de 0,1 kg es el
  mismo de antes (100 g). Las piezas (huevos, panales) van de a una.
*/
function escalaSegunUnidad(unidad: string): { factor: number; etiqueta: string; paso: number } {
  const normalizada = unidad.trim().toLowerCase();
  if (normalizada === "g") return { factor: 1000, etiqueta: "kg", paso: 0.1 };
  if (normalizada === "cc" || normalizada === "ml") return { factor: 1000, etiqueta: "litros", paso: 0.1 };
  return { factor: 1, etiqueta: "u.", paso: 1 };
}

type Props = {
  item: ItemCanastaIA;
  onCambiarCantidad: (categoria: string, cantidad: number) => void;
  onCambiarGama: (categoria: string, gama: string) => void;
  onQuitar: (categoria: string) => void;
};

/*
  Una fila por categoria: en escritorio todo en una linea y en el celular en
  dos. Como tarjeta alta, 17 categorias eran 1.500 px de scroll antes de llegar
  a elegir la zona. El motivo que da la IA queda al pasar el mouse por el
  nombre: es contexto, y en la canasta basica era la misma frase en las 32
  filas.
*/
function ItemCanastaEditable({ item, onCambiarCantidad, onCambiarGama, onQuitar }: Props) {
  const { factor, etiqueta, paso } = escalaSegunUnidad(item.unidad);
  const mostrada = Math.round((item.cantidad / factor) * 100) / 100;
  // Lo que la persona esta tipeando, o null si no esta editando. Se aplica al
  // salir del campo o con Enter: aplicarlo en cada tecla peleaba con lo escrito
  // ("3," se leia como 3 y el campo saltaba).
  const [escribiendo, setEscribiendo] = useState<string | null>(null);
  const cambiar = (valor: number) => {
    const cantidad = Math.round(valor * factor);
    if (cantidad > 0) onCambiarCantidad(item.categoria, cantidad);
  };
  const aplicar = () => {
    if (escribiendo === null) return;
    const valor = leerCantidad(escribiendo);
    if (valor !== null) cambiar(valor);
    setEscribiendo(null);
  };

  return (
    <div className="bg-papel rounded-xl border border-linea px-3.5 py-2 grid grid-cols-[minmax(0,1fr)_auto] sm:grid-cols-[minmax(0,1fr)_auto_auto_auto] items-center gap-x-4 gap-y-2">
      <p className="min-w-0 font-medium text-sm text-tinta truncate" title={item.razon || undefined}>
        {nombreCategoria(item.categoria)}
      </p>

      {/*
        El control no se encoge (shrink-0) y la etiqueta baja de linea antes que
        recortar un boton. En el iPhone el campo va a 16 px (index.css, para que
        iOS no haga zoom) y el control se encogia dentro de la fila: el "+"
        quedaba fuera del overflow-hidden, en x=117 de una caja que terminaba en
        112 (medido el 2026-11-18, tu-canasta-confiable).
      */}
      {/* En el celular el control y la gama comparten una fila que se parte si
          no entran (a 375 y 414 px, la gama baja). En la computadora, sm:contents
          devuelve los dos a sus columnas de la grilla. */}
      <div className="col-span-2 row-start-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5 sm:contents">
      <div className="shrink-0 flex items-center gap-1.5">
        <div className="shrink-0 flex items-center rounded-lg border border-linea overflow-hidden">
          <button
            onClick={() => cambiar(mostrada - paso)}
            disabled={item.cantidad - paso * factor <= 0}
            aria-label="Reducir cantidad"
            className="shrink-0 px-2.5 py-1 text-tinta-media hover:bg-papel-hundido disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
          >
            −
          </button>
          <input
            type="text"
            inputMode="decimal"
            value={escribiendo ?? mostrarCantidad(mostrada)}
            onFocus={(e) => {
              setEscribiendo(mostrarCantidad(mostrada));
              e.target.select();
            }}
            onChange={(e) => setEscribiendo(e.target.value)}
            onBlur={aplicar}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.currentTarget.blur();
              if (e.key === "Escape") {
                setEscribiendo(null);
                e.currentTarget.blur();
              }
            }}
            aria-label={`Cantidad de ${nombreCategoria(item.categoria)} en ${etiqueta} por mes`}
            className="numero w-16 min-w-0 px-1 text-center text-sm py-1 border-x border-linea focus:outline-none"
          />
          <button
            onClick={() => cambiar(mostrada + paso)}
            aria-label="Aumentar cantidad"
            className="shrink-0 px-2.5 py-1 text-tinta-media hover:bg-papel-hundido transition-colors"
          >
            +
          </button>
        </div>
        <span className="text-xs text-tinta-suave whitespace-nowrap">{etiqueta} / mes</span>
      </div>

      <div
        role="group"
        aria-label={`Gama de ${nombreCategoria(item.categoria)}`}
        className="ml-auto sm:ml-0 inline-flex rounded-lg border border-linea bg-papel-hundido p-0.5"
      >
        {GAMAS.map((gama) => (
          <button
            key={gama}
            onClick={() => onCambiarGama(item.categoria, gama)}
            aria-pressed={item.gama === gama}
            className={[
              "px-2 py-0.5 text-xs rounded-md transition-colors",
              item.gama === gama ? "bg-papel text-tinta font-semibold shadow-sm" : "text-tinta-suave hover:text-tinta-media",
            ].join(" ")}
          >
            {ETIQUETA_GAMA[gama]}
          </button>
        ))}
      </div>
      </div>

      <button
        onClick={() => onQuitar(item.categoria)}
        aria-label={`Quitar ${nombreCategoria(item.categoria)}`}
        title="Quitar"
        className="col-start-2 row-start-1 sm:col-start-auto sm:row-start-auto justify-self-end text-tinta-suave hover:text-alerta text-lg leading-none px-2 py-1 rounded-md hover:bg-alerta-tenue transition-colors"
      >
        ×
      </button>
    </div>
  );
}

export default ItemCanastaEditable;
