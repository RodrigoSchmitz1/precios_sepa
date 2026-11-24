import { useState, type FormEvent } from "react";
import { formatearPesos, porcentajeEntero } from "../../utils/formato";
import { avancePresupuesto, guardarPresupuesto, leerPresupuesto } from "../../utils/presupuesto";
import { leerMonto } from "./monto";

/*
  Presupuesto del mes (openspec mis-gastos-para-volver): cuanto lleva, cuanto
  queda y un aviso desde el 80 %. Queda solo en el telefono.
*/
function PresupuestoDelMes({ gastado }: { gastado: number }) {
  const [presupuesto, setPresupuesto] = useState<number | null>(() => leerPresupuesto());
  const [editando, setEditando] = useState(false);
  const [texto, setTexto] = useState("");
  const [sinGuardar, setSinGuardar] = useState(false);

  function guardar(e: FormEvent) {
    e.preventDefault();
    const monto = leerMonto(texto);
    if (!monto) return;
    setSinGuardar(!guardarPresupuesto(monto));
    setPresupuesto(monto);
    setEditando(false);
  }

  function sacar() {
    guardarPresupuesto(null);
    setPresupuesto(null);
    setEditando(false);
  }

  if (editando || presupuesto === null) {
    if (!editando) {
      return (
        <button type="button" onClick={() => setEditando(true)} className="mt-3 text-sm font-semibold text-marca underline underline-offset-2">
          Ponerte un presupuesto para el mes
        </button>
      );
    }
    return (
      <form onSubmit={guardar} className="mt-3 flex flex-wrap items-center gap-2">
        <label htmlFor="presupuesto" className="text-sm text-tinta">
          Presupuesto del mes
        </label>
        <input
          id="presupuesto"
          inputMode="decimal"
          autoFocus
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="$ 300.000"
          className="w-36 rounded-xl border border-linea-fuerte bg-papel px-3 py-2 text-base numero"
        />
        <button type="submit" className="fondo-marca text-white font-bold rounded-xl px-4 py-2 text-sm">
          Guardar
        </button>
        <button type="button" onClick={() => setEditando(false)} className="text-sm text-tinta-media px-2 py-2">
          Cancelar
        </button>
        {presupuesto !== null && (
          <button type="button" onClick={sacar} className="text-sm text-alerta px-2 py-2">
            Sacar presupuesto
          </button>
        )}
      </form>
    );
  }

  const avance = avancePresupuesto(gastado, presupuesto);
  const color = avance.estado === "pasado" ? "bg-alerta" : avance.estado === "cerca" ? "bg-aviso" : "bg-ahorro";
  return (
    <div className="mt-3" aria-label="Presupuesto del mes">
      <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
        <span className="text-tinta">
          {porcentajeEntero(Math.min(avance.fraccion, 9.99))} de tu presupuesto de <span className="numero">{formatearPesos(presupuesto)}</span>
        </span>
        <button type="button" onClick={() => { setTexto(String(presupuesto)); setEditando(true); }} className="text-xs text-tinta-suave underline">
          Cambiar
        </button>
      </div>
      <div className="mt-1 h-2.5 rounded-full bg-papel-hundido overflow-hidden" aria-hidden="true">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.min(100, avance.fraccion * 100)}%` }} />
      </div>
      <p className={`mt-1 text-sm ${avance.estado === "bien" ? "text-tinta-media" : "font-semibold text-tinta"}`}>
        {avance.estado === "pasado"
          ? `Te pasaste por ${formatearPesos(-avance.queda)}.`
          : avance.estado === "cerca"
            ? `⚠️ Estás cerca del tope: te quedan ${formatearPesos(avance.queda)}.`
            : `Te quedan ${formatearPesos(avance.queda)}.`}
      </p>
      {sinGuardar && <p className="text-xs text-tinta-suave">Este navegador no deja guardar: vale solo para esta visita.</p>}
    </div>
  );
}

export default PresupuestoDelMes;
