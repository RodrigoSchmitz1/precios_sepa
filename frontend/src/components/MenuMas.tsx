import { useEffect, useState } from "react";
import { NavLink, useLocation } from "react-router";
import { MENU_MAS, rutaDeMas } from "../utils/secciones";
import { InterruptorDatosAnonimos } from "./DatosAnonimos";

/*
  "Mas", arriba a la derecha en el celular (openspec app-para-el-usuario).
  Reemplaza al carrito del encabezado, que repetia Mi compra de la barra, y
  libera el lugar del centro de la barra para el boton de cargar un ticket.
  La hoja con las demas secciones sigue siendo la misma.
*/
export default function BotonMas() {
  const { pathname } = useLocation();
  // La hoja recuerda en que pagina se abrio: al navegar a otra queda cerrada sola.
  const [abiertaEn, setAbiertaEn] = useState<string | null>(null);
  const abierta = abiertaEn === pathname;
  const enMas = rutaDeMas(pathname);

  useEffect(() => {
    if (!abierta) return;
    const alTeclear = (e: KeyboardEvent) => e.key === "Escape" && setAbiertaEn(null);
    window.addEventListener("keydown", alTeclear);
    return () => window.removeEventListener("keydown", alTeclear);
  }, [abierta]);

  return (
    <>
      <button
        type="button"
        aria-label="Más secciones"
        aria-expanded={abierta}
        aria-controls="hoja-mas"
        aria-current={enMas ? "page" : undefined}
        onClick={() => setAbiertaEn(abierta ? null : pathname)}
        className={`sm:hidden shrink-0 grid place-items-center w-11 h-11 rounded-full text-xl ${
          enMas || abierta ? "bg-marca-tenue text-marca" : "text-tinta-media"
        }`}
      >
        <span aria-hidden="true">☰</span>
      </button>
      {abierta && (
        <div className="sm:hidden fixed inset-0 z-[1250]" role="presentation">
          <button
            type="button"
            aria-label="Cerrar el menú"
            className="absolute inset-0 w-full h-full bg-tinta/30"
            onClick={() => setAbiertaEn(null)}
          />
          <div
            id="hoja-mas"
            role="menu"
            aria-label="Más secciones"
            className="absolute inset-x-0 bottom-0 rounded-t-3xl bg-papel px-4 pt-4 pb-[calc(84px+env(safe-area-inset-bottom))] shadow-[0_-8px_30px_rgb(20_20_80/0.15)]"
          >
            <ul className="grid gap-1">
              {MENU_MAS.map((s) => (
                <li key={s.ruta}>
                  <NavLink
                    to={s.ruta}
                    role="menuitem"
                    onClick={() => setAbiertaEn(null)}
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
    </>
  );
}
