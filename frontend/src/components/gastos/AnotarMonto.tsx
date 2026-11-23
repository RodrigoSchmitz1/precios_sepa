import { useState } from "react";
import type { Gasto } from "../../types";
import { gastoAMano, hoyEnArgentina } from "../../utils/gastos";
import { leerMonto } from "./monto";

const SUPERS = ["Carrefour", "Coto", "Día", "Jumbo", "Disco", "Vea", "Changomas", "La Anónima", "Cooperativa Obrera", "Chino del barrio"];

/* Anotar un gasto sin foto: súper, fecha y monto (openspec mis-gastos-y-barra-nueva). */
export default function AnotarMonto({ onGuardar, onCancelar }: { onGuardar: (g: Gasto) => void; onCancelar: () => void }) {
  const [cadena, setCadena] = useState("");
  const [fecha, setFecha] = useState(hoyEnArgentina());
  const [montoTexto, setMontoTexto] = useState("");
  const monto = leerMonto(montoTexto);
  const completo = cadena.trim() !== "" && /^\d{4}-\d{2}-\d{2}$/.test(fecha) && monto != null && monto > 0;

  return (
    <section className="tarjeta p-5 sm:p-6 mb-6">
      <h2 className="text-lg font-bold text-tinta mb-3">Anotar un gasto</h2>
      <form
        className="grid gap-3 sm:grid-cols-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (completo) onGuardar(gastoAMano(cadena.trim(), fecha, monto!));
        }}
      >
        <label className="grid gap-1 text-sm text-tinta-media">
          Súper
          <input list="supers-gastos" value={cadena} onChange={(e) => setCadena(e.target.value)} className="campo" placeholder="Coto, Día…" />
          <datalist id="supers-gastos">
            {SUPERS.map((s) => <option key={s} value={s} />)}
          </datalist>
        </label>
        <label className="grid gap-1 text-sm text-tinta-media">
          Fecha
          <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className="campo" />
        </label>
        <label className="grid gap-1 text-sm text-tinta-media">
          Monto
          <input inputMode="decimal" value={montoTexto} onChange={(e) => setMontoTexto(e.target.value)} className="campo numero" placeholder="$ 25.000" />
        </label>
        <div className="sm:col-span-3 flex flex-wrap gap-2">
          <button type="submit" disabled={!completo} className="fondo-marca text-white font-bold rounded-2xl min-h-12 px-5 disabled:opacity-50">
            Guardar
          </button>
          <button type="button" onClick={onCancelar} className="text-tinta-media font-semibold min-h-12 px-3">
            Cancelar
          </button>
        </div>
      </form>
    </section>
  );
}
