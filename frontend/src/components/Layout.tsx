import { Outlet, NavLink } from "react-router";
import AvisoZona from "./AvisoZona";
import ProveedorZona from "./ProveedorZona";
import ProveedorLista from "./ProveedorLista";
import AccesoLista from "./AccesoLista";
import SelectorZona from "./SelectorZona";
import BarraCelular from "./BarraCelular";
import { SECCIONES } from "../utils/secciones";

function Layout() {
  return (
    <ProveedorZona>
    <ProveedorLista>
    <div className="min-h-screen bg-lienzo">
      <header className="sticky top-0 z-20 bg-papel shadow-[0_1px_0_var(--color-linea)]">
        {/*
          El logo va pegado al borde izquierdo y no alineado con la columna de
          texto: un logo centrado en el contenedor del contenido se lee como un
          titulo mas de la pagina. La nav mantiene su propio ancho a la derecha.
        */}
        <div className="px-5 sm:px-7 h-16 sm:h-[4.5rem] flex items-center justify-between gap-3 sm:gap-6">
          <div className="flex items-center gap-3 min-w-0">
          <NavLink to="/" className="flex items-center gap-2.5 shrink-0" aria-label="Changuito, inicio">
            {/*
              El chango, dibujado y no una imagen: son cuatro trazos, pesa cero y
              toma el color del texto, asi que no hay que mantener un PNG por
              cada fondo. La canasta va en verde -el acento de ahorro del
              sistema- y la estructura en tinta.
            */}
            {/* 2026-10-14: el chango va en blanco sobre un cuadradito con el
                degrade de la marca, como el icono de una app. */}
            <span className="fondo-marca w-9 h-9 rounded-xl grid place-items-center shrink-0 shadow-[0_4px_12px_rgb(91_61_245/0.35)]">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M1.5 2.5h2.6l1 4.2m0 0L7.4 15h10.2l2.9-8.3H5.1z" stroke="white"
                      strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M5.1 6.7h15.4l-2.9 8.3H7.4z" fill="white" fillOpacity="0.3" />
                <circle cx="9" cy="19.5" r="1.8" fill="white" />
                <circle cx="16.5" cy="19.5" r="1.8" fill="white" />
              </svg>
            </span>
            <span className="font-display text-xl sm:text-2xl leading-none text-tinta">Changuito</span>
          </NavLink>
          {/* La zona del usuario, en todas las paginas (zona compartida, 2026-11). */}
          <SelectorZona />
          </div>
          <div className="flex items-center gap-2 sm:gap-4 min-w-0">

          {/*
            La nav scrollea en horizontal en pantallas chicas en vez de cortarse
            en dos lineas y empujar el contenido hacia abajo.
          */}
          {/* min-w-0: sin eso la nav no puede achicarse por debajo de su
              contenido y, con el logo mas grande, empujaba la barra hasta
              meter scroll horizontal en pantallas angostas. Con min-w-0 hace
              lo que dice el comentario de arriba: scrollea ella sola. */}
          <nav className="hidden sm:flex gap-1 overflow-x-auto -mx-1 px-1 min-w-0">
            {SECCIONES.map((seccion) => (
              <NavLink
                key={seccion.ruta}
                to={seccion.ruta}
                end={seccion.ruta === "/"}
                className={({ isActive }) =>
                  [
                    "whitespace-nowrap rounded-full px-3.5 py-2 text-sm font-semibold transition-colors",
                    isActive
                      ? "bg-marca text-white shadow-[0_4px_12px_rgb(91_61_245/0.3)]"
                      : "text-tinta-media hover:text-marca hover:bg-marca-tenue",
                  ].join(" ")
                }
              >
                {seccion.nombre}
              </NavLink>
            ))}
          </nav>
          {/* Tu lista, en todas las paginas (lista-a-mano, 2026-11). */}
          <AccesoLista />
          </div>
        </div>
      </header>

      <main className="py-10 px-5">
        <AvisoZona />
        <Outlet />
      </main>

      <BarraCelular />

      <footer className="mt-16 bg-papel pb-20 sm:pb-0">
        <div className="max-w-5xl mx-auto px-5 py-6 text-xs text-tinta-suave">
          Datos del{" "}
          <a
            href="https://datos.produccion.gob.ar/dataset/sepa-precios"
            target="_blank"
            rel="noreferrer"
            className="underline underline-offset-2 hover:text-tinta-media"
          >
            SEPA (Secretaría de Comercio)
          </a>
          . Precios de referencia, pueden diferir de la góndola.{" "}
          <NavLink to="/como-se-calcula" className="underline underline-offset-2 hover:text-tinta-media">
            Cómo se calcula cada número
          </NavLink>
          .
        </div>
      </footer>
    </div>
    </ProveedorLista>
    </ProveedorZona>
  );
}

export default Layout;
