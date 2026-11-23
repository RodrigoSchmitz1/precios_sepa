import { useEffect, useState } from "react";
import { NavLink, useLocation } from "react-router";
import { useLista } from "../contexto/lista";
import { BARRA_CELULAR, MENU_MAS, rutaDeMas } from "../utils/secciones";
import { InterruptorDatosAnonimos } from "./DatosAnonimos";

/** El numero de productos de la lista, sobre el icono de "Mi lista". */
function ContadorLista() {
  const { lista } = useLista();
  if (lista.length === 0) return null;
  return (
    <span
      aria-hidden="true"
      className="absolute -top-1 -right-1 min-w-5 h-5 px-1 rounded-full bg-ahorro text-white text-[11px] font-bold leading-5 text-center numero"
    >
      {lista.length}
    </span>
  );
}

function Icono({ icono, activo, children }: { icono: string; activo: boolean; children?: React.ReactNode }) {
  return (
    <span
      aria-hidden="true"
      className={`relative grid place-items-center w-11 h-7 rounded-full text-lg ${activo ? "bg-marca-tenue" : ""}`}
    >
      {icono}
      {children}
    </span>
  );
}

const CLASE_BOTON = "flex flex-col items-center justify-center gap-0.5 min-h-[52px] w-full pt-2 pb-1.5 text-[11px] font-semibold transition-colors";

/*
  En el celular, las secciones van en una barra fija abajo, como en una app
  (2026-10-14). Cinco lugares: cuatro secciones y "Mas", que abre una hoja con
  las demas (mis-gastos-y-barra-nueva). Por encima del mapa: los controles de
  Leaflet llegan a z-index 1000.
*/
export default function BarraCelular() {
  const { pathname } = useLocation();
  // La hoja recuerda en que pagina se abrio: al navegar a otra queda cerrada sola.
  const [abiertaEn, setAbiertaEn] = useState<string | null>(null);
  const abierta = abiertaEn === pathname;
  const setAbierta = (valor: boolean | ((previo: boolean) => boolean)) =>
    setAbiertaEn((previo) => {
      const siguiente = typeof valor === "function" ? valor(previo === pathname) : valor;
      return siguiente ? pathname : null;
    });
  const enMas = rutaDeMas(pathname);

  useEffect(() => {
    if (!abierta) return;
    const alTeclear = (e: KeyboardEvent) => e.key === "Escape" && setAbiertaEn(null);
    window.addEventListener("keydown", alTeclear);
    return () => window.removeEventListener("keydown", alTeclear);
  }, [abierta]);

  return (
    <>
      {abierta && (
        <div className="sm:hidden fixed inset-0 z-[1250]" role="presentation">
          <button
            type="button"
            aria-label="Cerrar el menú"
            className="absolute inset-0 w-full h-full bg-tinta/30"
            onClick={() => setAbierta(false)}
          />
          <div
            id="hoja-mas"
            role="menu"
            aria-label="Más secciones"
            className="absolute inset-x-0 bottom-0 rounded-t-3xl bg-papel px-4 pt-4 pb-[calc(76px+env(safe-area-inset-bottom))] shadow-[0_-8px_30px_rgb(20_20_80/0.15)]"
          >
            <ul className="grid gap-1">
              {MENU_MAS.map((s) => (
                <li key={s.ruta}>
                  <NavLink
                    to={s.ruta}
                    role="menuitem"
                    onClick={() => setAbierta(false)}
                    className={({ isActive }) =>
                      `flex items-center gap-3 min-h-12 rounded-2xl px-3 text-base font-semibold ${isActive ? "bg-marca-tenue text-marca" : "text-tinta"}`
                    }
                  >
                    <span aria-hidden="true" className="text-xl">{s.icono}</span>
                    {s.nombre}
                  </NavLink>
                </li>
              ))}
            </ul>
            {/* Las señales anonimas se apagan aca en un toque (openspec senales-anonimas). */}
            <div className="mt-2 pt-2 border-t border-linea">
              <InterruptorDatosAnonimos />
            </div>
          </div>
        </div>
      )}
      <nav
        aria-label="Secciones"
        className="sm:hidden fixed bottom-0 inset-x-0 z-[1300] bg-papel shadow-[0_-4px_20px_rgb(20_20_80/0.08)] pb-[env(safe-area-inset-bottom)]"
      >
        <ul className="grid grid-cols-5">
          {BARRA_CELULAR.map((seccion) => (
            <li key={seccion.ruta}>
              <NavLink
                to={seccion.ruta}
                end={seccion.ruta === "/"}
                className={({ isActive }) => `${CLASE_BOTON} ${isActive && !abierta ? "text-marca" : "text-tinta-suave"}`}
              >
                {({ isActive }) => (
                  <>
                    <Icono icono={seccion.icono} activo={isActive && !abierta}>
                      {seccion.ruta === "/lista" && <ContadorLista />}
                    </Icono>
                    {seccion.corto}
                  </>
                )}
              </NavLink>
            </li>
          ))}
          <li>
            <button
              type="button"
              aria-expanded={abierta}
              aria-controls="hoja-mas"
              aria-current={enMas ? "page" : undefined}
              onClick={() => setAbierta((a) => !a)}
              className={`${CLASE_BOTON} ${enMas || abierta ? "text-marca" : "text-tinta-suave"}`}
            >
              <Icono icono="☰" activo={enMas || abierta} />
              Más
            </button>
          </li>
        </ul>
      </nav>
    </>
  );
}
