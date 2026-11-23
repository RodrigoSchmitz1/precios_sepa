import { useEffect } from "react";
import {
  abrirHojaSenales,
  apagarSenales,
  cerrarHojaSenales,
  marcarAvisoVisto,
  prenderSenales,
  useSenales,
} from "../utils/senales";

/*
  Las señales anonimas en pantalla (openspec senales-anonimas): un aviso de una
  linea la primera vez, la hoja "Mas info" y el interruptor. Nada de esto se ve
  si el servicio no las activa (SENALES_ACTIVAS).
*/

/** El interruptor: se apaga y se prende en un toque, sin confirmar. */
export function InterruptorDatosAnonimos({ conTexto = true }: { conTexto?: boolean }) {
  const { activas, apagadas } = useSenales();
  if (!activas) return null;
  const prendidas = !apagadas;
  return (
    <button
      type="button"
      role="switch"
      aria-checked={prendidas}
      onClick={() => (prendidas ? apagarSenales() : prenderSenales())}
      className="flex items-center justify-between gap-3 w-full min-h-12 rounded-2xl px-3 text-left text-base font-semibold text-tinta hover:bg-papel-hundido"
    >
      <span className="flex items-center gap-3">
        <span aria-hidden="true" className="text-xl">
          📊
        </span>
        <span>
          Datos anónimos
          {conTexto && (
            <span className="block text-xs font-normal text-tinta-suave">
              {prendidas ? "Sumás a las estadísticas de qué se mira" : "No se manda nada"}
            </span>
          )}
        </span>
      </span>
      <span
        aria-hidden="true"
        className={`relative shrink-0 w-11 h-6 rounded-full transition-colors ${prendidas ? "bg-ahorro" : "bg-linea-fuerte"}`}
      >
        <span
          className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${prendidas ? "left-[22px]" : "left-0.5"}`}
        />
      </span>
    </button>
  );
}

/** El aviso de una linea, debajo de las promos del dia, una sola vez por telefono. */
export function AvisoDatosAnonimos() {
  const { activas, avisoVisto } = useSenales();
  if (!activas || avisoVisto) return null;
  return (
    <p role="status" className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-tinta-media bg-papel-hundido rounded-xl px-3 py-2">
      <span className="min-w-0">📊 Changuito cuenta de forma anónima qué categorías se miran, para estadísticas.</span>
      <span className="flex gap-2">
        <button type="button" onClick={marcarAvisoVisto} className="font-semibold text-tinta px-2 py-1 rounded-lg hover:bg-papel">
          Entendido
        </button>
        <button type="button" onClick={abrirHojaSenales} className="font-semibold text-marca px-2 py-1 rounded-lg hover:bg-papel">
          Más info
        </button>
      </span>
    </p>
  );
}

/** Link del pie de pagina a la hoja, para escritorio (en el celular esta en el menu Mas). */
export function LinkDatosAnonimos() {
  const { activas } = useSenales();
  if (!activas) return null;
  return (
    <>
      {" "}
      <button type="button" onClick={abrirHojaSenales} className="underline underline-offset-2 hover:text-tinta-media">
        Datos anónimos
      </button>
      .
    </>
  );
}

/** La hoja "Mas info": que se cuenta, que no, para que, y el interruptor. */
export function HojaDatosAnonimos() {
  const { activas, hojaAbierta } = useSenales();

  useEffect(() => {
    if (!hojaAbierta) return;
    const alTeclear = (e: KeyboardEvent) => e.key === "Escape" && cerrarHojaSenales();
    window.addEventListener("keydown", alTeclear);
    return () => window.removeEventListener("keydown", alTeclear);
  }, [hojaAbierta]);

  if (!activas || !hojaAbierta) return null;
  return (
    <div className="fixed inset-0 z-[1400] grid items-end sm:items-center justify-center" role="presentation">
      <button type="button" aria-label="Cerrar" className="absolute inset-0 w-full h-full bg-tinta/30" onClick={cerrarHojaSenales} />
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="titulo-datos-anonimos"
        className="relative w-full sm:max-w-md bg-papel rounded-t-3xl sm:rounded-3xl p-5 pb-[calc(20px+env(safe-area-inset-bottom))] text-sm text-tinta-media leading-relaxed"
      >
        <h2 id="titulo-datos-anonimos" className="font-display text-xl text-tinta mb-2">
          Datos anónimos
        </h2>
        <p>
          Changuito cuenta qué categorías de promos se miran, qué productos se piden en los avisos de oferta y qué se busca,
          para armar estadísticas agregadas para marcas y supermercados.
        </p>
        <ul className="mt-3 space-y-1.5">
          <li>
            <strong className="text-tinta">Qué se cuenta:</strong> la categoría que abrís, el producto del aviso, y la
            categoría de lo que buscás (lo que escribís no se guarda). Con tu zona: provincia y localidad.
          </li>
          <li>
            <strong className="text-tinta">Qué no:</strong> tu nombre, tu ubicación exacta, tu IP, tus gastos ni tus
            tickets.
          </li>
          <li>
            <strong className="text-tinta">Sin perfil:</strong> el identificador al azar cambia cada día, así que no se
            puede saber qué hizo una misma persona de un día para otro. Un grupo de pocas personas no se muestra.
          </li>
        </ul>
        <div className="mt-4 -mx-3">
          <InterruptorDatosAnonimos />
        </div>
        <button
          type="button"
          onClick={cerrarHojaSenales}
          className="mt-3 w-full min-h-11 rounded-2xl bg-marca-tenue text-marca font-bold"
        >
          Listo
        </button>
      </section>
    </div>
  );
}
