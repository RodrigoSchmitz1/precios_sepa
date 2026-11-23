import { useRef, useState } from "react";
import { leerTicket } from "../../api/client";
import type { Gasto, LineaGasto, TicketLeido } from "../../types";
import { formatearPesos } from "../../utils/formato";
import { achicarFoto } from "../../utils/fotos";
import { aceptarAviso, avisoAceptado, buscarDuplicado, diferenciaConTotal, gastoDeTicket, guardarConstantes, hoyEnArgentina } from "../../utils/gastos";
import { nombreCategoria } from "../../utils/nombres";
import { leerMonto } from "./monto";

export const MAXIMO_FOTOS = 3;

export function TextoAviso() {
  return (
    <ul className="grid gap-2 text-sm text-tinta-media leading-relaxed list-disc pl-5">
      <li>La foto se manda a leer y <strong className="text-tinta">no se guarda</strong> en ningún lado.</li>
      <li>El DNI, la tarjeta y el nombre que figuren en el ticket se descartan.</li>
      <li>Tus gastos quedan <strong className="text-tinta">solo en este teléfono</strong>: no hace falta cuenta.</li>
    </ul>
  );
}

type Estado =
  | { paso: "inicio" }
  | { paso: "aviso" }
  | { paso: "leyendo" }
  | { paso: "error"; mensaje: string; fotos: string[] | null }
  | { paso: "ilegible" }
  | { paso: "revisar"; ticket: TicketLeido };

/*
  Cargar un ticket desde fotos (openspec mis-gastos-y-barra-nueva): aviso la
  primera vez, de 1 a 3 fotos achicadas en el telefono, lectura en la API y
  revision antes de guardar. Nada se guarda sin que el usuario confirme.
*/
export default function CargarTicket({
  gastos,
  onGuardar,
  onAnotarAMano,
}: {
  gastos: Gasto[];
  onGuardar: (gasto: Gasto) => void;
  onAnotarAMano: () => void;
}) {
  const [estado, setEstado] = useState<Estado>({ paso: "inicio" });
  const entrada = useRef<HTMLInputElement>(null);

  const elegirFotos = () => {
    if (!avisoAceptado()) {
      setEstado({ paso: "aviso" });
      return;
    }
    entrada.current?.click();
  };

  const mandar = async (fotos: string[]) => {
    setEstado({ paso: "leyendo" });
    try {
      const respuesta = await leerTicket(fotos);
      if (respuesta.legible) guardarConstantes(respuesta.constantes);
      setEstado(respuesta.legible ? { paso: "revisar", ticket: respuesta.ticket } : { paso: "ilegible" });
    } catch (error) {
      setEstado({ paso: "error", mensaje: error instanceof Error ? error.message : "No se pudo leer el ticket.", fotos });
    }
  };

  const alElegir = async (archivos: FileList | null) => {
    const elegidos = [...(archivos ?? [])].slice(0, MAXIMO_FOTOS);
    if (entrada.current) entrada.current.value = "";
    if (elegidos.length === 0) return;
    setEstado({ paso: "leyendo" });
    let fotos: string[];
    try {
      fotos = await Promise.all(elegidos.map(achicarFoto));
    } catch {
      setEstado({ paso: "error", mensaje: "No pudimos abrir la foto. Probá sacarla de nuevo con la cámara.", fotos: null });
      return;
    }
    await mandar(fotos);
  };

  return (
    <section className="tarjeta p-5 sm:p-6 mb-6" aria-live="polite">
      <input
        ref={entrada}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        aria-label="Fotos del ticket"
        onChange={(e) => alElegir(e.target.files)}
      />

      {estado.paso === "inicio" && (
        <div className="grid gap-3 sm:grid-cols-2">
          <button type="button" onClick={elegirFotos} className="fondo-marca text-white font-bold rounded-2xl min-h-12 px-4">
            📷 Sacar foto del ticket
          </button>
          <button type="button" onClick={onAnotarAMano} className="bg-marca-tenue text-marca font-bold rounded-2xl min-h-12 px-4">
            ✍️ Anotar un monto
          </button>
          <p className="sm:col-span-2 text-xs text-tinta-suave">
            Si el ticket es largo, podés mandar hasta {MAXIMO_FOTOS} fotos: de arriba hacia abajo.
          </p>
        </div>
      )}

      {estado.paso === "aviso" && (
        <div>
          <h2 className="text-lg font-bold text-tinta mb-3">Antes de la primera foto</h2>
          <TextoAviso />
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              className="fondo-marca text-white font-bold rounded-2xl min-h-12 px-5"
              onClick={() => {
                aceptarAviso();
                setEstado({ paso: "inicio" });
                entrada.current?.click();
              }}
            >
              Entendido, sacar la foto
            </button>
            <button type="button" className="text-tinta-media font-semibold min-h-12 px-3" onClick={() => setEstado({ paso: "inicio" })}>
              Ahora no
            </button>
          </div>
        </div>
      )}

      {estado.paso === "leyendo" && <p className="text-base text-tinta">Leyendo el ticket…</p>}

      {estado.paso === "ilegible" && (
        <div>
          <p className="text-base text-tinta font-semibold">No pudimos leer el ticket.</p>
          <p className="text-sm text-tinta-media mt-1">Probá con más luz, el ticket estirado y la foto de frente.</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" onClick={elegirFotos} className="fondo-marca text-white font-bold rounded-2xl min-h-12 px-5">
              Sacar otra foto
            </button>
            <button type="button" onClick={onAnotarAMano} className="bg-marca-tenue text-marca font-bold rounded-2xl min-h-12 px-5">
              Anotar el monto
            </button>
          </div>
        </div>
      )}

      {estado.paso === "error" && (
        <div>
          <p className="text-base text-tinta font-semibold">{estado.mensaje}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {estado.fotos && (
              <button type="button" onClick={() => mandar(estado.fotos!)} className="fondo-marca text-white font-bold rounded-2xl min-h-12 px-5">
                Probar de nuevo
              </button>
            )}
            <button type="button" onClick={onAnotarAMano} className="bg-marca-tenue text-marca font-bold rounded-2xl min-h-12 px-5">
              Anotar el monto
            </button>
            <button type="button" onClick={() => setEstado({ paso: "inicio" })} className="text-tinta-media font-semibold min-h-12 px-3">
              Cancelar
            </button>
          </div>
        </div>
      )}

      {estado.paso === "revisar" && (
        <RevisarTicket
          ticket={estado.ticket}
          gastos={gastos}
          onGuardar={(g) => {
            onGuardar(g);
            setEstado({ paso: "inicio" });
          }}
          onOtraFoto={elegirFotos}
          onCancelar={() => setEstado({ paso: "inicio" })}
        />
      )}
    </section>
  );
}

export function RevisarTicket({
  ticket,
  gastos,
  onGuardar,
  onOtraFoto,
  onCancelar,
}: {
  ticket: TicketLeido;
  gastos: Gasto[];
  onGuardar: (gasto: Gasto) => void;
  onOtraFoto: () => void;
  onCancelar: () => void;
}) {
  const [cadena, setCadena] = useState(ticket.cadena ?? "");
  const [fecha, setFecha] = useState(ticket.fecha ?? hoyEnArgentina());
  const [totalTexto, setTotalTexto] = useState(ticket.total != null ? String(ticket.total).replace(".", ",") : "");
  const [lineas, setLineas] = useState<LineaGasto[]>(ticket.lineas);
  const [confirmarDuplicado, setConfirmarDuplicado] = useState(false);

  const total = leerMonto(totalTexto);
  const diferencia = total != null ? diferenciaConTotal(lineas, ticket.descuentos, total) : 0;
  const completo = cadena.trim() !== "" && /^\d{4}-\d{2}-\d{2}$/.test(fecha) && total != null && total > 0;
  const duplicado = completo ? buscarDuplicado(gastos, { cadena, comprobante: ticket.comprobante, fecha, total: total! }) : null;

  const guardar = () => {
    if (!completo) return;
    if (duplicado && !confirmarDuplicado) {
      setConfirmarDuplicado(true);
      return;
    }
    onGuardar(gastoDeTicket(ticket, { cadena: cadena.trim(), fecha, total: total!, lineas }));
  };

  return (
    <div>
      <h2 className="text-lg font-bold text-tinta mb-3">Revisá el ticket</h2>
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="grid gap-1 text-sm text-tinta-media">
          Súper
          <input value={cadena} onChange={(e) => setCadena(e.target.value)} className="campo" />
        </label>
        <label className="grid gap-1 text-sm text-tinta-media">
          Fecha
          <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className="campo" />
        </label>
        <label className="grid gap-1 text-sm text-tinta-media">
          Total
          <input inputMode="decimal" value={totalTexto} onChange={(e) => setTotalTexto(e.target.value)} className="campo numero" />
        </label>
      </div>

      {total != null && Math.abs(diferencia) >= 1 && (
        <p role="status" className="mt-3 rounded-2xl bg-alerta-tenue text-tinta text-sm p-3">
          {diferencia > 0
            ? `Faltan ${formatearPesos(diferencia)} de líneas para llegar al total. Podés guardarlo igual o sacar otra foto.`
            : `Las líneas suman ${formatearPesos(-diferencia)} más que el total. Revisá si alguna se leyó dos veces.`}
        </p>
      )}

      <ul className="mt-4 divide-y divide-linea">
        {lineas.map((l, i) => (
          <li key={i} className="flex items-start gap-3 py-2">
            <div className="flex-1 min-w-0">
              <p className="text-sm text-tinta break-words">{l.nombre ?? l.descripcion}</p>
              <p className="text-xs text-tinta-suave">
                {l.cantidad !== 1 && `${String(l.cantidad).replace(".", ",")} × ${formatearPesos(l.precio_unitario)} · `}
                {nombreCategoria(l.categoria)}
              </p>
            </div>
            <span className="text-sm text-tinta numero shrink-0">{formatearPesos(l.importe)}</span>
            <button
              type="button"
              aria-label={`Sacar ${l.descripcion}`}
              onClick={() => setLineas((ls) => ls.filter((_, j) => j !== i))}
              className="shrink-0 w-11 h-11 -my-2 grid place-items-center text-tinta-suave"
            >
              ✕
            </button>
          </li>
        ))}
        {ticket.descuentos.map((d, i) => (
          <li key={`d${i}`} className="flex items-start gap-3 py-2 text-ahorro">
            <p className="flex-1 min-w-0 text-sm break-words">{d.descripcion}</p>
            <span className="text-sm numero shrink-0">−{formatearPesos(d.importe)}</span>
            <span className="w-11 shrink-0" />
          </li>
        ))}
      </ul>

      {duplicado && confirmarDuplicado && (
        <p role="alert" className="mt-3 rounded-2xl bg-alerta-tenue text-tinta text-sm p-3">
          Este ticket ya está cargado (del {duplicado.fecha.split("-").reverse().join("/")}). Tocá “Guardar igual” solo si es otra compra.
        </p>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" disabled={!completo} onClick={guardar} className="fondo-marca text-white font-bold rounded-2xl min-h-12 px-5 disabled:opacity-50">
          {duplicado && confirmarDuplicado ? "Guardar igual" : "Guardar"}
        </button>
        <button type="button" onClick={onOtraFoto} className="bg-marca-tenue text-marca font-bold rounded-2xl min-h-12 px-5">
          Sacar otra foto
        </button>
        <button type="button" onClick={onCancelar} className="text-tinta-media font-semibold min-h-12 px-3">
          Cancelar
        </button>
      </div>
    </div>
  );
}
