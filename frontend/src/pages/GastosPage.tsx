import { useEffect, useMemo, useState } from "react";
import { obtenerBasicos } from "../api/client";
import { useZona } from "../contexto/zona";
import Titular from "../components/Titular";
import AnotarMonto from "../components/gastos/AnotarMonto";
import CargarTicket, { TextoAviso } from "../components/gastos/CargarTicket";
import TicketGuardado from "../components/gastos/TicketGuardado";
import ElMesEnTuZona from "../components/gastos/ElMesEnTuZona";
import ParaTuProximaCompra from "../components/gastos/ParaTuProximaCompra";
import PresupuestoDelMes from "../components/gastos/PresupuestoDelMes";
import BotonCompartir from "../components/BotonCompartir";
import { compraHabitual } from "../utils/compraHabitual";
import type { Basico, Gasto } from "../types";
import { descartarEjemplo, ejemploDescartado, gastosDeEjemplo } from "../utils/gastosDeEjemplo";
import { bajarExcel } from "../utils/excelGastos";
import { formatearPesos, mesEnPalabras, porcentajeEntero } from "../utils/formato";
import { MAXIMO_GASTOS, agregarGasto, borrarTodos, guardarGastos, hoyEnArgentina, leerCoberturaMinima, leerGastos } from "../utils/gastos";
import { nombreCategoria } from "../utils/nombres";
import { mesDe, mesesConGastos, rachaDeSemanas, resumirMes, textoInformeDelMes, type FilaResumen } from "../utils/resumenGastos";

/*
  Mis gastos (openspec mis-gastos-y-barra-nueva): el registro de lo que se gasta
  en el super, a partir de fotos de tickets o montos anotados a mano, guardado
  solo en este telefono.

  Con cero gastos se ve un mes de ejemplo (openspec ejemplo-para-empezar): los
  numeros salen de los basicos reales, pero viven solo en memoria. El
  presupuesto, el Excel, la compra habitual, la racha y compartir leen solo los
  gastos reales.
*/
function GastosPage() {
  const [gastos, setGastos] = useState<Gasto[]>(() => leerGastos());
  const { zona } = useZona();
  const [descartado, setDescartado] = useState(ejemploDescartado);
  const [basicos, setBasicos] = useState<Basico[]>([]);
  const pideEjemplo = gastos.length === 0 && !descartado;
  useEffect(() => {
    if (!pideEjemplo) return;
    let cancelado = false;
    Promise.resolve()
      .then(() => obtenerBasicos())
      .then((b) => !cancelado && setBasicos(b))
      .catch(() => {
        /* sin basicos no hay ejemplo: la pagina queda como antes */
      });
    return () => {
      cancelado = true;
    };
  }, [pideEjemplo]);
  const hoy = hoyEnArgentina();
  const cadenasZona = zona?.cadenas.join("|") ?? "";
  const ejemplo = useMemo(
    () => (pideEjemplo ? gastosDeEjemplo(basicos, cadenasZona ? cadenasZona.split("|") : [], hoy) : []),
    [pideEjemplo, basicos, cadenasZona, hoy]
  );
  const verEjemplo = ejemplo.length > 0;
  const mostrados = verEjemplo ? ejemplo : gastos;
  const [anotando, setAnotando] = useState(false);
  const [sinGuardar, setSinGuardar] = useState(false);
  const [lleno, setLleno] = useState(false);
  const [confirmarBorrarTodo, setConfirmarBorrarTodo] = useState(false);
  const meses = useMemo(() => mesesConGastos(mostrados), [mostrados]);
  const [mesElegido, setMesElegido] = useState<string | null>(null);
  const mes = mesElegido && meses.includes(mesElegido) ? mesElegido : (meses[0] ?? mesDe(hoyEnArgentina()));
  const resumen = useMemo(() => resumirMes(mostrados, mes), [mostrados, mes]);
  // En el ejemplo todas las lineas estan vinculadas: se compara siempre.
  const coberturaMinima = verEjemplo ? 0 : leerCoberturaMinima();
  const habitual = useMemo(() => compraHabitual(gastos, hoy), [gastos, hoy]);
  const racha = useMemo(() => rachaDeSemanas(gastos, hoy), [gastos, hoy]);

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
    if (!descartado) {
      descartarEjemplo();
      setDescartado(true);
    }
    setMesElegido(mesDe(gasto.fecha));
    actualizar(nuevos);
  };

  const indice = meses.indexOf(mes);

  return (
    <div className="max-w-3xl mx-auto">
      <Titular antetitulo="Mis gastos" compacto>
        {mostrados.length === 0
          ? "Llevá la cuenta de lo que gastás en el súper"
          : `En ${mesEnPalabras(`${mes}-01`)} gastaste ${formatearPesos(resumen.total)}`}
      </Titular>

      {verEjemplo && (
        <section role="note" aria-label="Mes de ejemplo" className="tarjeta p-5 sm:p-6 mb-6 border-l-4 border-marca">
          <p className="text-xs font-bold uppercase tracking-wide text-marca mb-1">Ejemplo</p>
          <p className="text-base font-bold text-tinta">Así se ve con tus tickets. Es un ejemplo.</p>
          <p className="text-sm text-tinta-media mt-1 mb-4">
            Son 7 compras armadas con precios de hoy. Cuando cargues tu primer gasto, el ejemplo se va solo.
          </p>
          <button
            type="button"
            onClick={() => {
              descartarEjemplo();
              setDescartado(true);
            }}
            className="rounded-xl border border-linea-fuerte px-4 py-2.5 text-sm font-bold text-tinta hover:border-marca"
          >
            Borrar el ejemplo y empezar
          </button>
        </section>
      )}

      {mostrados.length === 0 && (
        <p className="text-base text-tinta-media leading-relaxed mb-6">
          Cargá cada compra del súper. Vas a ver cuánto gastás por mes, en qué súper y en qué categorías,
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

      {mostrados.length > 0 && (
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
            {!verEjemplo && <PresupuestoDelMes gastado={resumen.total} />}
            <div className="mt-5 grid gap-6 sm:grid-cols-2">
              <Barras titulo="Por súper" filas={resumen.porSuper} total={resumen.total} />
              <Barras titulo="Por categoría" filas={resumen.porCategoria.map((f) => ({ ...f, nombre: nombreCategoria(f.nombre) }))} total={resumen.total} maximo={8} />
            </div>
            <ElMesEnTuZona gastos={mostrados} mes={mes} coberturaMinima={coberturaMinima} />
            {/* Informe del mes para compartir y racha (openspec mis-gastos-para-volver). */}
            {!verEjemplo && (
              <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
                {racha >= 2 ? (
                  <p className="text-sm font-semibold text-tinta">🔥 {racha} semanas seguidas cargando tus gastos</p>
                ) : (
                  <span />
                )}
                <BotonCompartir
                  etiqueta="Compartir el mes"
                  copiarTexto
                  datos={() => ({
                    titulo: "Mis gastos en el súper · Changuito",
                    texto: textoInformeDelMes(resumen, nombreCategoria),
                    url: `${window.location.origin}/gastos`,
                  })}
                />
              </div>
            )}
          </section>

          <ParaTuProximaCompra habitual={habitual} />

          <section aria-label="Tickets del mes" className="grid gap-2 mb-8">
            {resumen.gastos.map((g) => (
              <TicketGuardado
                key={g.id}
                gasto={g}
                coberturaMinima={coberturaMinima}
                onBorrar={verEjemplo ? undefined : () => actualizar(gastos.filter((x) => x.id !== g.id))}
              />
            ))}
          </section>

          {!verEjemplo && (
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
          )}
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
