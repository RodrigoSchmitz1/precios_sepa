import { useState } from "react";
import { cotizarLista } from "../../api/client";
import { useZona } from "../../contexto/zona";
import type { Gasto } from "../../types";
import { compararTicket, itemsDelTicket, type Comparacion } from "../../utils/comparacionTicket";
import { formatearPesos, porcentajeEntero } from "../../utils/formato";
import { nombreCategoria } from "../../utils/nombres";

/*
  Un gasto de la lista del mes, plegado. Al abrirlo se ven sus lineas y, si es
  de una foto, cuanto salian sus productos en la cadena mas barata de la zona
  (se cotiza recien al abrir: no hay un pedido por cada ticket de la lista).
*/
export default function TicketGuardado({
  gasto,
  coberturaMinima,
  onBorrar,
}: {
  gasto: Gasto;
  /** La regla que mando la API al leer un ticket; null: no se compara. */
  coberturaMinima: number | null;
  /** Sin onBorrar no se ofrece borrar: los tickets de ejemplo (ejemplo-para-empezar). */
  onBorrar?: () => void;
}) {
  const { zona } = useZona();
  const [comparacion, setComparacion] = useState<Comparacion | "cargando" | "error" | null>(null);
  const [confirmar, setConfirmar] = useState(false);
  const ahorro = gasto.descuentos.reduce((s, d) => s + d.importe, 0);

  const cotizar = async () => {
    if (comparacion !== null || gasto.origen !== "foto" || coberturaMinima == null) return;
    const datos = itemsDelTicket(gasto);
    if (datos.cobertura < coberturaMinima || datos.items.length === 0) {
      setComparacion(compararTicket(gasto, datos, null, coberturaMinima));
      return;
    }
    if (!zona) {
      setComparacion({ estado: "sin-zona" });
      return;
    }
    setComparacion("cargando");
    try {
      const cotizacion = await cotizarLista(datos.items, zona.cadenas);
      setComparacion(compararTicket(gasto, datos, cotizacion, coberturaMinima));
    } catch {
      setComparacion("error");
    }
  };

  return (
    <details className="tarjeta px-4 py-3" onToggle={(e) => (e.currentTarget as HTMLDetailsElement).open && cotizar()}>
      <summary className="flex items-center gap-3 min-h-11 cursor-pointer list-none">
        <span className="text-sm text-tinta-suave numero w-12 shrink-0">{gasto.fecha.slice(8, 10)}/{gasto.fecha.slice(5, 7)}</span>
        <span className="flex-1 min-w-0 text-base font-semibold text-tinta truncate">
          {gasto.cadena}
          {gasto.origen === "mano" && <span className="ml-2 text-xs font-normal text-tinta-suave">a mano</span>}
        </span>
        <span className="text-base font-bold text-tinta numero shrink-0">{formatearPesos(gasto.total)}</span>
      </summary>

      <div className="pt-3">
        {gasto.origen === "foto" && coberturaMinima != null && <BloqueComparacion comparacion={comparacion} coberturaMinima={coberturaMinima} />}
        {gasto.lineas.length > 0 && (
          <ul className="mt-3 divide-y divide-linea">
            {gasto.lineas.map((l, i) => (
              <li key={i} className="flex items-start gap-3 py-2">
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-tinta break-words">{l.nombre ?? l.descripcion}</p>
                  <p className="text-xs text-tinta-suave">{nombreCategoria(l.categoria)}</p>
                </div>
                <span className="text-sm numero shrink-0">{formatearPesos(l.importe)}</span>
              </li>
            ))}
          </ul>
        )}
        {ahorro > 0 && <p className="mt-2 text-sm text-ahorro font-semibold">Ahorraste {formatearPesos(ahorro)} en promos</p>}
        {onBorrar && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {confirmar ? (
              <>
                <span className="text-sm text-tinta">¿Borrar este gasto?</span>
                <button type="button" onClick={onBorrar} className="text-alerta font-bold min-h-11 px-3">Sí, borrar</button>
                <button type="button" onClick={() => setConfirmar(false)} className="text-tinta-media font-semibold min-h-11 px-3">No</button>
              </>
            ) : (
              <button type="button" onClick={() => setConfirmar(true)} className="text-tinta-media text-sm font-semibold min-h-11 px-1">
                Borrar este gasto
              </button>
            )}
          </div>
        )}
      </div>
    </details>
  );
}

function BloqueComparacion({ comparacion, coberturaMinima }: { comparacion: Comparacion | "cargando" | "error" | null; coberturaMinima: number }) {
  if (comparacion === null || comparacion === "cargando") return <p className="text-sm text-tinta-suave">Comparando con tu zona…</p>;
  if (comparacion === "error") return <p className="text-sm text-tinta-suave">No pudimos comparar este ticket ahora.</p>;
  switch (comparacion.estado) {
    case "sin-zona":
      return <p className="text-sm text-tinta-media">Elegí tu zona arriba para ver cuánto salían estos productos en los súper que tenés cerca.</p>;
    case "poca-cobertura":
      return (
        <p className="text-sm text-tinta-media">
          Reconocimos {porcentajeEntero(comparacion.cobertura)} de este ticket: no alcanza para compararlo (hace falta al menos {porcentajeEntero(coberturaMinima)}).
        </p>
      );
    case "sin-cadena-completa":
      return <p className="text-sm text-tinta-media">Ningún súper de tu zona informa precio de todos estos productos.</p>;
    case "ok":
      if (comparacion.esLaMisma) {
        return (
          <p className="rounded-2xl bg-ahorro-tenue text-tinta text-sm p-3">
            Compraste en el súper de tu zona donde estos productos salían más baratos, a precio de lista.
          </p>
        );
      }
      if (comparacion.diferencia <= 0) {
        // La mas barata que tiene todo cobra mas que lo que figura en el ticket:
        // no se puede decir que se compro "en la mas barata" (el super del
        // ticket puede no informar todos esos productos a SEPA).
        return (
          <p className="rounded-2xl bg-ahorro-tenue text-tinta text-sm p-3">
            Ningún súper de tu zona tenía estos productos más baratos: en <strong>{comparacion.cadena}</strong>, el más barato con
            todos, salían <strong className="numero">{formatearPesos(comparacion.total)}</strong> a precio de lista.
          </p>
        );
      }
      return (
        <p className="rounded-2xl bg-marca-tenue text-tinta text-sm p-3">
          Estos productos te figuran {formatearPesos(comparacion.pagado)} en el ticket. En <strong>{comparacion.cadena}</strong> salían{" "}
          <strong className="numero">{formatearPesos(comparacion.total)}</strong>, {formatearPesos(comparacion.diferencia)} menos. A precio de lista, sin promos.
        </p>
      );
  }
}
