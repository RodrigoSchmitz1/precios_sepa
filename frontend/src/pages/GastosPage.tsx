import { useMemo, useState } from "react";
import Titular from "../components/Titular";
import AnotarMonto from "../components/gastos/AnotarMonto";
import CargarTicket, { TextoAviso } from "../components/gastos/CargarTicket";
import TicketGuardado from "../components/gastos/TicketGuardado";
import type { Gasto } from "../types";
import { bajarExcel } from "../utils/excelGastos";
import { formatearPesos, mesEnPalabras, porcentajeEntero } from "../utils/formato";
import { MAXIMO_GASTOS, agregarGasto, borrarTodos, guardarGastos, hoyEnArgentina, leerCoberturaMinima, leerGastos } from "../utils/gastos";
import { nombreCategoria } from "../utils/nombres";
import { mesDe, mesesConGastos, resumirMes, type FilaResumen } from "../utils/resumenGastos";

/*
  Mis gastos (openspec mis-gastos-y-barra-nueva): el registro de lo que se gasta
  en el super, a partir de fotos de tickets o montos anotados a mano, guardado
  solo en este telefono.
*/
function GastosPage() {
  const [gastos, setGastos] = useState<Gasto[]>(() => leerGastos());
  const [anotando, setAnotando] = useState(false);
  const [sinGuardar, setSinGuardar] = useState(false);
  const [lleno, setLleno] = useState(false);
  const [confirmarBorrarTodo, setConfirmarBorrarTodo] = useState(false);
  const meses = useMemo(() => mesesConGastos(gastos), [gastos]);
  const [mesElegido, setMesElegido] = useState<string | null>(null);
  const mes = mesElegido && meses.includes(mesElegido) ? mesElegido : (meses[0] ?? mesDe(hoyEnArgentina()));
  const resumen = useMemo(() => resumirMes(gastos, mes), [gastos, mes]);
  const coberturaMinima = leerCoberturaMinima();

  const actualizar = (nuevos: Gasto[]) => {
    setGastos(nuevos);
    setSinGuardar(!guardarGastos(nuevos));
  };

  const guardar = (gasto: Gasto) => {
    const nuevos = agregarGasto(gastos, gasto);
    if (!nuevos) {
      setLleno(true);
      return;
    }
    setLleno(false);
    setAnotando(false);
    setMesElegido(mesDe(gasto.fecha));
    actualizar(nuevos);
  };

  const indice = meses.indexOf(mes);

  return (
    <div className="max-w-3xl mx-auto">
      <Titular antetitulo="Mis gastos" compacto>
        {gastos.length === 0
          ? "Llevá la cuenta de lo que gastás en el súper"
          : `En ${mesEnPalabras(`${mes}-01`)} gastaste ${formatearPesos(resumen.total)}`}
      </Titular>

      {gastos.length === 0 && (
        <p className="text-base text-tinta-media leading-relaxed mb-6">
          Sacale una foto al ticket o anotá el monto. Vas a ver cuánto gastás por mes, en qué súper y en qué categorías,
          cuánto ahorraste en promos y cuánto salía lo mismo en la cadena más barata de tu zona.
        </p>
      )}

      {sinGuardar && (
        <p role="alert" className="rounded-2xl bg-alerta-tenue text-tinta text-sm p-3 mb-4">
          Este navegador no deja guardar datos: vas a ver tus gastos en esta visita, pero no van a quedar guardados.
        </p>
      )}
      {lleno && (
        <p role="alert" className="rounded-2xl bg-alerta-tenue text-tinta text-sm p-3 mb-4">
          Llegaste a {MAXIMO_GASTOS} gastos guardados. Bajá tus gastos a Excel y borrá los más viejos para seguir cargando.
        </p>
      )}

      {anotando ? (
        <AnotarMonto onGuardar={guardar} onCancelar={() => setAnotando(false)} />
      ) : (
        <CargarTicket gastos={gastos} onGuardar={guardar} onAnotarAMano={() => setAnotando(true)} />
      )}

      {gastos.length > 0 && (
        <>
          <section className="tarjeta p-5 sm:p-6 mb-6" aria-label="Resumen del mes">
            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                aria-label="Mes anterior"
                disabled={indice < 0 || indice >= meses.length - 1}
                onClick={() => setMesElegido(meses[indice + 1])}
                className="w-11 h-11 grid place-items-center rounded-full text-tinta disabled:opacity-30"
              >
                ‹
              </button>
              <h2 className="text-lg font-bold text-tinta capitalize">{mesEnPalabras(`${mes}-01`)} {mes.slice(0, 4)}</h2>
              <button
                type="button"
                aria-label="Mes siguiente"
                disabled={indice <= 0}
                onClick={() => setMesElegido(meses[indice - 1])}
                className="w-11 h-11 grid place-items-center rounded-full text-tinta disabled:opacity-30"
              >
                ›
              </button>
            </div>
            <p className="mt-2 text-4xl font-extrabold text-tinta numero">{formatearPesos(resumen.total)}</p>
            {resumen.variacion != null && (
              <p className="text-sm text-tinta-media">
                {Math.abs(resumen.variacion) < 0.005
                  ? "Lo mismo que el mes anterior"
                  : `${porcentajeEntero(Math.abs(resumen.variacion))} ${resumen.variacion > 0 ? "más" : "menos"} que el mes anterior (${formatearPesos(resumen.mesAnterior!)})`}
              </p>
            )}
            {resumen.ahorroPromos > 0 && (
              <p className="mt-2 text-base font-semibold text-ahorro">Ahorraste {formatearPesos(resumen.ahorroPromos)} en promos</p>
            )}
            <div className="mt-5 grid gap-6 sm:grid-cols-2">
              <Barras titulo="Por súper" filas={resumen.porSuper} total={resumen.total} />
              <Barras titulo="Por categoría" filas={resumen.porCategoria.map((f) => ({ ...f, nombre: nombreCategoria(f.nombre) }))} total={resumen.total} maximo={8} />
            </div>
          </section>

          <section aria-label="Tickets del mes" className="grid gap-2 mb-8">
            {resumen.gastos.map((g) => (
              <TicketGuardado
                key={g.id}
                gasto={g}
                coberturaMinima={coberturaMinima}
                onBorrar={() => actualizar(gastos.filter((x) => x.id !== g.id))}
              />
            ))}
          </section>

          <div className="flex flex-wrap items-center gap-3 mb-6">
            <button
              type="button"
              onClick={() => bajarExcel(gastos, hoyEnArgentina())}
              className="bg-ahorro text-white font-bold rounded-2xl min-h-12 px-5"
            >
              Bajar a Excel
            </button>
            {confirmarBorrarTodo ? (
              <span className="flex flex-wrap items-center gap-2">
                <span className="text-sm text-tinta">¿Borrar todos tus gastos? No se puede deshacer.</span>
                <button
                  type="button"
                  className="text-alerta font-bold min-h-11 px-3"
                  onClick={() => {
                    borrarTodos();
                    setGastos([]);
                    setMesElegido(null);
                    setConfirmarBorrarTodo(false);
                  }}
                >
                  Sí, borrar todo
                </button>
                <button type="button" className="text-tinta-media font-semibold min-h-11 px-3" onClick={() => setConfirmarBorrarTodo(false)}>
                  No
                </button>
              </span>
            ) : (
              <button type="button" onClick={() => setConfirmarBorrarTodo(true)} className="text-tinta-media text-sm font-semibold min-h-11 px-2">
                Borrar todos mis gastos
              </button>
            )}
          </div>
        </>
      )}

      <details className="text-sm text-tinta-media mb-6">
        <summary className="cursor-pointer min-h-11 flex items-center font-semibold">Qué pasa con tus fotos y tus gastos</summary>
        <div className="pt-2">
          <TextoAviso />
        </div>
      </details>
    </div>
  );
}

function Barras({ titulo, filas, total, maximo = 6 }: { titulo: string; filas: FilaResumen[]; total: number; maximo?: number }) {
  const visibles = filas.slice(0, maximo);
  const resto = filas.slice(maximo).reduce((s, f) => s + f.total, 0);
  const todas = resto > 0 ? [...visibles, { nombre: "Otras", total: resto }] : visibles;
  return (
    <div>
      <h3 className="text-sm font-bold text-tinta mb-2">{titulo}</h3>
      <ul className="grid gap-2">
        {todas.map((f) => (
          <li key={f.nombre}>
            <div className="flex items-baseline justify-between gap-2 text-sm">
              <span className="text-tinta truncate">{f.nombre}</span>
              <span className="text-tinta numero shrink-0">{formatearPesos(f.total)}</span>
            </div>
            <div className="mt-1 h-2 rounded-full bg-papel-hundido overflow-hidden" aria-hidden="true">
              <div className="h-full rounded-full bg-marca" style={{ width: `${total > 0 ? Math.max(2, (f.total / total) * 100) : 0}%` }} />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default GastosPage;
