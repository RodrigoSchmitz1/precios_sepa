import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useZona } from "../contexto/zona";
import { formatearNumero } from "../utils/formato";
import { buscarZonas, rotuloZona, type Zona } from "../utils/zona";

/*
  El boton de la zona en el encabezado y su panel (zona compartida, 2026-11).

  Esta en todas las paginas porque la zona es de todas: se ve donde se esta
  mirando y se cambia sin buscar en que pantalla se eligio. En el celular el
  panel sale desde abajo, al alcance del pulgar, con el campo en 16 px para que
  iOS no haga zoom.
*/
function SelectorZona() {
  const { zona, zonas, lista, elegir, usarUbicacion, ubicando, errorUbicacion } = useZona();
  const [abierto, setAbierto] = useState(false);
  const [texto, setTexto] = useState("");
  const campo = useRef<HTMLInputElement>(null);
  const [zonaAlAbrir, setZonaAlAbrir] = useState<Zona | null>(null);

  // Si "usar mi ubicacion" eligio una zona, el panel se cierra solo. Se ajusta
  // durante el render, como recomienda React, y no en un efecto.
  if (abierto && zona && zona !== zonaAlAbrir) {
    setAbierto(false);
  }

  useEffect(() => {
    if (!abierto) return;
    campo.current?.focus();
    const alTeclear = (e: KeyboardEvent) => {
      if (e.key === "Escape") setAbierto(false);
    };
    window.addEventListener("keydown", alTeclear);
    return () => window.removeEventListener("keydown", alTeclear);
  }, [abierto]);

  const abrir = () => {
    setTexto("");
    setZonaAlAbrir(zona);
    setAbierto(true);
  };
  const opciones = buscarZonas(zonas, texto);
  const elegirYCerrar = (nueva: Zona | null) => {
    elegir(nueva);
    setAbierto(false);
  };

  return (
    <>
      <button
        type="button"
        onClick={abrir}
        aria-haspopup="dialog"
        aria-expanded={abierto}
        className={[
          "flex items-center gap-1.5 min-w-0 rounded-full px-3 py-1.5 text-sm font-semibold transition-colors",
          zona ? "bg-marca-tenue text-marca" : "border border-linea-fuerte text-tinta-media hover:text-marca",
        ].join(" ")}
      >
        <span aria-hidden="true">📍</span>
        <span className="truncate">{zona ? rotuloZona(zona) : lista ? "Elegí tu zona" : "Tu zona"}</span>
      </button>

      {/* En un portal: adentro del encabezado (sticky, z-20) el panel quedaba
          debajo de la barra de secciones del celular, que tapaba los resultados. */}
      {abierto && createPortal(
        <div className="fixed inset-0 z-[1300] flex items-end sm:items-start sm:justify-center sm:pt-24">
          <button
            type="button"
            aria-label="Cerrar"
            onClick={() => setAbierto(false)}
            className="absolute inset-0 bg-tinta/40"
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="titulo-zona"
            // Alto fijo en el celular: con el teclado abierto, un panel que crece
            // desde abajo deja los resultados debajo del teclado. Asi el campo
            // queda en la mitad de arriba y las opciones entran sobre el teclado.
            className="relative w-full sm:max-w-md bg-papel rounded-t-3xl sm:rounded-3xl p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-[0_-8px_30px_rgb(20_20_80/0.15)] h-[85dvh] sm:h-auto sm:max-h-[85vh] overflow-y-auto"
          >
            <div className="flex items-baseline justify-between gap-3 mb-1">
              <h2 id="titulo-zona" className="font-display text-xl text-tinta">
                ¿Dónde comprás?
              </h2>
              <button type="button" onClick={() => setAbierto(false)} className="py-1 text-sm text-tinta-suave">
                Cerrar
              </button>
            </div>
            <p className="text-sm text-tinta-suave mb-4">
              Te mostramos las cadenas y las promos de tu barrio o localidad, en todas las páginas.
            </p>

            <button
              type="button"
              onClick={usarUbicacion}
              disabled={ubicando || zonas.length === 0}
              className="w-full flex items-center justify-center gap-2 rounded-2xl fondo-marca text-white font-bold py-3 disabled:opacity-60"
            >
              <span aria-hidden="true">📍</span>
              {ubicando ? "Buscando tu ubicación…" : "Usar mi ubicación"}
            </button>
            {errorUbicacion && (
              <p role="alert" className="mt-2 text-sm text-alerta">
                {errorUbicacion}
              </p>
            )}

            <label htmlFor="buscar-zona" className="block text-sm font-semibold text-tinta mt-5 mb-1.5">
              O buscá tu barrio o localidad
            </label>
            <input
              id="buscar-zona"
              ref={campo}
              type="search"
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              placeholder="Ej: Palermo, Rosario, Mar del Plata"
              autoComplete="off"
              className="w-full rounded-2xl border border-linea-fuerte bg-papel px-4 py-3 text-base text-tinta placeholder:text-tinta-suave focus:outline-2 focus:outline-marca"
            />

            {texto.trim().length >= 2 && (
              <ul className="mt-2 divide-y divide-linea" aria-label="Zonas encontradas">
                {opciones.length === 0 ? (
                  <li className="py-3 text-sm text-tinta-suave">
                    No encontramos sucursales en "{texto.trim()}". Probá con el barrio o la ciudad más cercana.
                  </li>
                ) : (
                  opciones.map((opcion) => (
                    <li key={`${opcion.provincia}:${opcion.nombre}`}>
                      <button
                        type="button"
                        onClick={() => elegirYCerrar(opcion)}
                        className="w-full flex items-baseline justify-between gap-3 py-3 text-left"
                      >
                        <span className="text-base text-tinta">{rotuloZona(opcion)}</span>
                        <span className="text-xs text-tinta-suave shrink-0">
                          {formatearNumero(opcion.cadenas.length)} {opcion.cadenas.length === 1 ? "cadena" : "cadenas"}
                        </span>
                      </button>
                    </li>
                  ))
                )}
              </ul>
            )}

            {zona && (
              <button
                type="button"
                onClick={() => elegirYCerrar(null)}
                className="mt-5 w-full py-2.5 text-sm text-tinta-media underline underline-offset-2"
              >
                Borrar zona y ver todo el país
              </button>
            )}
          </div>
        </div>,
        document.body
      )}
    </>
  );
}

export default SelectorZona;
