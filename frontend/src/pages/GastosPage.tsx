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
import {
  comprasPorSuper,
  encabezadoDeDia,
  gastoPorDia,
  mesDe,
  mesesConGastos,
  porDia,
  rachaDeSemanas,
  resumirMes,
  semanasDelMes,
  textoInformeDelMes,
} from "../utils/resumenGastos";
import { DonaCategorias, PorSuper, SemanaASemana } from "../components/gastos/GraficosDelMes";

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
  const semanas = useMemo(() => semanasDelMes(mostrados, mes), [mostrados, mes]);

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

  return (
    <div className="max-w-3xl mx-auto">
      <Titular antetitulo="Mis gastos" compacto>
        {/* El total del mes va en la tarjeta principal: aca no se repite. */}
        {mostrados.length === 0 ? "Llevá la cuenta de lo que gastás en el súper" : "Lo que gastás en el súper, mes a mes"}
      </Titular>

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

      {mostrados.length > 0 && (
        <>
          {meses.length > 1 && (
            <div className="flex gap-2 overflow-x-auto pb-1 mb-3" role="group" aria-label="Mes">
              {[...meses].reverse().map((m) => (
                <button
                  key={m}
                  type="button"
                  aria-pressed={m === mes}
                  onClick={() => setMesElegido(m)}
                  className={`shrink-0 rounded-full min-h-10 px-4 text-sm font-semibold capitalize border ${
                    m === mes ? "bg-tinta text-white border-tinta" : "bg-papel text-tinta-media border-linea"
                  }`}
                >
                  {mesEnPalabras(`${m}-01`)}
                  {m.slice(0, 4) !== hoy.slice(0, 4) ? ` ${m.slice(0, 4)}` : ""}
                </button>
              ))}
            </div>
          )}

          {/* La tarjeta principal del mes (mis-gastos-como-app). */}
          <section aria-label="Resumen del mes" className="relative overflow-hidden fondo-marca text-white rounded-3xl p-5 sm:p-6 mb-4 shadow-flotante">
            <span aria-hidden="true" className="absolute -right-16 -top-20 w-56 h-56 rounded-full bg-white/[0.08]" />
            <div className="relative">
              <p className="text-sm font-semibold text-white/85">
                En {mesEnPalabras(`${mes}-01`)} gastaste{" "}
                <span className="block mt-1 text-4xl font-extrabold text-white numero tracking-tight">{formatearPesos(resumen.total)}</span>
              </p>
              {resumen.variacion != null && (
                <p className="mt-2 inline-block rounded-full bg-white/15 px-3 py-1 text-xs font-bold">
                  {Math.abs(resumen.variacion) < 0.005
                    ? "Lo mismo que el mes anterior"
                    : `${resumen.variacion > 0 ? "▲" : "▼"} ${porcentajeEntero(Math.abs(resumen.variacion))} ${resumen.variacion > 0 ? "más" : "menos"} que el mes anterior (${formatearPesos(resumen.mesAnterior!)})`}
                </p>
              )}
              <dl className="mt-4 grid grid-cols-3 gap-2">
                {[
                  [String(resumen.gastos.length), resumen.gastos.length === 1 ? "compra" : "compras"],
                  [formatearPesos(Math.round(resumen.total / Math.max(1, resumen.gastos.length))), "por compra"],
                  [formatearPesos(Math.round(gastoPorDia(resumen.total, mes, hoy))), "por día"],
                ].map(([valor, etiqueta]) => (
                  <div key={etiqueta} className="rounded-2xl bg-white/15 border border-white/20 px-2.5 py-2 min-w-0">
                    <dd className="text-sm sm:text-base font-bold numero truncate">{valor}</dd>
                    <dt className="text-[11px] text-white/85">{etiqueta}</dt>
                  </div>
                ))}
              </dl>
            </div>
          </section>
        </>
      )}

      {verEjemplo && (
        <section role="note" aria-label="Mes de ejemplo" className="rounded-2xl bg-aviso-tenue border border-linea p-4 mb-4 flex gap-3">
          <span aria-hidden="true">👀</span>
          <div className="text-sm text-tinta leading-relaxed">
            <p>
              <strong>Son datos de ejemplo:</strong> {ejemplo.length} tickets por {formatearPesos(ejemplo.reduce((s, g) => s + g.total, 0))} armados con
              precios de hoy. Cuando cargues tus tickets, esta página va a mostrar tus compras.
            </p>
            <button
              type="button"
              onClick={() => {
                descartarEjemplo();
                setDescartado(true);
              }}
              className="mt-2 rounded-xl border border-linea-fuerte bg-papel px-3 py-2 text-sm font-bold text-tinta hover:border-marca"
            >
              Borrar el ejemplo y empezar
            </button>
          </div>
        </section>
      )}

      {anotando ? (
        <AnotarMonto onGuardar={guardar} onCancelar={() => setAnotando(false)} />
      ) : (
        <CargarTicket gastos={gastos} onGuardar={guardar} onAnotarAMano={() => setAnotando(true)} />
      )}

      {mostrados.length > 0 && (
        <>
          <section className="tarjeta p-5 sm:p-6 mb-4" aria-labelledby="titulo-ahorro">
            <h2 id="titulo-ahorro" className="text-base font-bold text-tinta mb-3">Tu ahorro del mes</h2>
            <div className="rounded-2xl bg-ahorro-tenue p-3">
              <p className="text-xl font-extrabold text-ahorro numero">{formatearPesos(resumen.ahorroPromos)}</p>
              <p className="text-xs text-tinta-media">
                {resumen.ahorroPromos > 0
                  ? `Ahorraste ${formatearPesos(resumen.ahorroPromos)} en promos`
                  : "en promos este mes: sale de los tickets con foto"}
              </p>
            </div>
            <ElMesEnTuZona gastos={mostrados} mes={mes} coberturaMinima={coberturaMinima} />
          </section>

          <div className="grid gap-4 sm:grid-cols-2 mb-4">
            <section className="tarjeta p-5 sm:p-6" aria-labelledby="titulo-categorias">
              <h2 id="titulo-categorias" className="text-base font-bold text-tinta mb-3">
                En qué gastaste
              </h2>
              <DonaCategorias filas={resumen.porCategoria.map((f) => ({ ...f, nombre: nombreCategoria(f.nombre) }))} total={resumen.total} />
            </section>
            <section className="tarjeta p-5 sm:p-6" aria-labelledby="titulo-semanas">
              <h2 id="titulo-semanas" className="text-base font-bold text-tinta mb-3 flex items-baseline justify-between gap-2">
                Semana a semana
                <span className="text-xs font-semibold text-tinta-suave numero">
                  promedio {formatearPesos(Math.round(gastoPorDia(resumen.total, mes, hoy) * 7))}
                </span>
              </h2>
              <SemanaASemana
                tramos={semanas}
                tramoDeHoy={mesDe(hoy) === mes ? Math.min(Math.floor((Number(hoy.slice(8, 10)) - 1) / 7), semanas.length - 1) : null}
              />
            </section>
          </div>

          <section className="tarjeta p-5 sm:p-6 mb-4" aria-labelledby="titulo-super">
            <h2 id="titulo-super" className="text-base font-bold text-tinta mb-3">
              Por súper
            </h2>
            <PorSuper filas={resumen.porSuper} total={resumen.total} compras={comprasPorSuper(resumen.gastos)} />
          </section>

          {!verEjemplo && (
            <section className="tarjeta p-5 sm:p-6 mb-4" aria-label="Presupuesto">
              <PresupuestoDelMes gastado={resumen.total} />
            </section>
          )}

          <ParaTuProximaCompra habitual={habitual} />

          <section className="tarjeta p-5 sm:p-6 mb-6" aria-labelledby="titulo-movimientos">
            <h2 id="titulo-movimientos" className="text-base font-bold text-tinta mb-1 flex items-baseline justify-between gap-2">
              Movimientos
              <span className="text-xs font-semibold text-tinta-suave">
                {resumen.gastos.length} {resumen.gastos.length === 1 ? "gasto" : "gastos"}
              </span>
            </h2>
            {porDia(resumen.gastos).map((dia) => (
              <div key={dia.fecha}>
                <h3 className="mt-4 mb-1 text-xs font-bold uppercase tracking-wide text-tinta-suave">{encabezadoDeDia(dia.fecha, hoy)}</h3>
                <ul className="divide-y divide-linea">
                  {dia.gastos.map((g) => (
                    <li key={g.id}>
                      <TicketGuardado
                        gasto={g}
                        coberturaMinima={coberturaMinima}
                        onBorrar={verEjemplo ? undefined : () => actualizar(gastos.filter((x) => x.id !== g.id))}
                      />
                    </li>
                  ))}
                </ul>
              </div>
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
              {/* Informe del mes para compartir y racha (openspec mis-gastos-para-volver). */}
              <BotonCompartir
                etiqueta="Compartir el mes"
                copiarTexto
                datos={() => ({
                  titulo: "Mis gastos en el súper · Changuito",
                  texto: textoInformeDelMes(resumen, nombreCategoria),
                  url: `${window.location.origin}/gastos`,
                })}
              />
              {racha >= 2 && <p className="w-full text-sm font-semibold text-tinta">🔥 {racha} semanas seguidas cargando tus gastos</p>}
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
          <p className="text-xs text-tinta-suave text-center mb-4">Tus gastos quedan solo en este teléfono.</p>
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

export default GastosPage;
