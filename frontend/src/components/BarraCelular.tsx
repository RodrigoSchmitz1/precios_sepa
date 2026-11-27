import { NavLink, Link } from "react-router";
import { useLista } from "../contexto/lista";
import { BARRA_CELULAR, RUTA_CARGAR_TICKET } from "../utils/secciones";

/** El numero de productos de la lista, sobre el icono de "Mi compra". */
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

function Seccion({ seccion }: { seccion: (typeof BARRA_CELULAR)[number] }) {
  return (
    <li>
      <NavLink
        to={seccion.ruta}
        end={seccion.ruta === "/"}
        className={({ isActive }) => `${CLASE_BOTON} ${isActive ? "text-marca" : "text-tinta-suave"}`}
      >
        {({ isActive }) => (
          <>
            <Icono icono={seccion.icono} activo={isActive}>
              {seccion.ruta === "/lista" && <ContadorLista />}
            </Icono>
            {seccion.corto}
          </>
        )}
      </NavLink>
    </li>
  );
}

/*
  En el celular, las secciones van en una barra fija abajo, como en una app
  (2026-10-14). Desde app-para-el-usuario: dos secciones, el boton de cargar un
  ticket en el centro y dos secciones mas. "Mas" esta arriba a la derecha
  (MenuMas). Por encima del mapa: los controles de Leaflet llegan a z-index 1000.
*/
export default function BarraCelular() {
  const izquierda = BARRA_CELULAR.slice(0, 2);
  const derecha = BARRA_CELULAR.slice(2);
  return (
    <nav
      aria-label="Secciones"
      className="sm:hidden fixed bottom-0 inset-x-0 z-[1300] bg-papel shadow-[0_-4px_20px_rgb(20_20_80/0.08)] pb-[env(safe-area-inset-bottom)]"
    >
      <ul className="grid grid-cols-[1fr_1fr_76px_1fr_1fr] items-end">
        {izquierda.map((s) => (
          <Seccion key={s.ruta} seccion={s} />
        ))}
        <li>
          {/* Cargar un ticket es el gesto que la app quiere instalar: va destacado en el centro. */}
          <Link to={RUTA_CARGAR_TICKET} className={`${CLASE_BOTON} text-tinta`}>
            <span
              aria-hidden="true"
              className="-mt-7 grid place-items-center w-14 h-14 rounded-2xl fondo-marca text-white text-2xl border-4 border-papel shadow-[0_10px_20px_-8px_rgb(74_47_224/0.7)]"
            >
              📷
            </span>
            Ticket
          </Link>
        </li>
        {derecha.map((s) => (
          <Seccion key={s.ruta} seccion={s} />
        ))}
      </ul>
    </nav>
  );
}
