import { Outlet, NavLink } from "react-router";

const SECCIONES = [
  { ruta: "/", nombre: "Promos" },
  { ruta: "/canasta", nombre: "Canasta basica" },
  { ruta: "/canasta-personalizada", nombre: "Tu canasta" },
  { ruta: "/quien-gana", nombre: "Mas barato" },
  { ruta: "/mismo-producto", nombre: "Mismo producto" },
  { ruta: "/inflacion", nombre: "Inflacion" },
];

function Layout() {
  return (
    <div className="min-h-screen bg-lienzo">
      <header className="sticky top-0 z-20 bg-lienzo/90 backdrop-blur border-b border-linea">
        {/*
          El logo va pegado al borde izquierdo y no alineado con la columna de
          texto: un logo centrado en el contenedor del contenido se lee como un
          titulo mas de la pagina. La nav mantiene su propio ancho a la derecha.
        */}
        <div className="px-5 sm:px-7 h-20 flex items-center justify-between gap-6">
          <NavLink to="/" className="flex items-center gap-2.5 shrink-0" aria-label="Changuito, inicio">
            {/*
              El chango, dibujado y no una imagen: son cuatro trazos, pesa cero y
              toma el color del texto, asi que no hay que mantener un PNG por
              cada fondo. La canasta va en verde -el acento de ahorro del
              sistema- y la estructura en tinta.
            */}
            <svg width="30" height="30" viewBox="0 0 24 24" fill="none" aria-hidden="true" className="shrink-0">
              <path d="M1.5 2.5h2.6l1 4.2m0 0L7.4 15h10.2l2.9-8.3H5.1z" stroke="currentColor"
                    strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className="text-tinta" />
              <path d="M5.1 6.7h15.4l-2.9 8.3H7.4z" className="fill-ahorro/15" />
              <circle cx="9" cy="19.5" r="1.7" className="fill-ahorro" />
              <circle cx="16.5" cy="19.5" r="1.7" className="fill-ahorro" />
            </svg>
            <span className="font-display text-2xl sm:text-3xl leading-none text-tinta">Changuito</span>
          </NavLink>

          {/*
            La nav scrollea en horizontal en pantallas chicas en vez de cortarse
            en dos lineas y empujar el contenido hacia abajo.
          */}
          {/* min-w-0: sin eso la nav no puede achicarse por debajo de su
              contenido y, con el logo mas grande, empujaba la barra hasta
              meter scroll horizontal en pantallas angostas. Con min-w-0 hace
              lo que dice el comentario de arriba: scrollea ella sola. */}
          <nav className="flex gap-1 overflow-x-auto -mx-1 px-1 min-w-0">
            {SECCIONES.map((seccion) => (
              <NavLink
                key={seccion.ruta}
                to={seccion.ruta}
                end={seccion.ruta === "/"}
                className={({ isActive }) =>
                  [
                    "whitespace-nowrap rounded-full px-3 py-1.5 text-sm transition-colors",
                    isActive
                      ? "bg-ahorro-tenue text-ahorro font-semibold"
                      : "text-tinta-media hover:text-tinta hover:bg-papel-hundido",
                  ].join(" ")
                }
              >
                {seccion.nombre}
              </NavLink>
            ))}
          </nav>
        </div>
      </header>

      <main className="py-10 px-5">
        <Outlet />
      </main>

      <footer className="border-t border-linea mt-16">
        <div className="max-w-5xl mx-auto px-5 py-6 text-xs text-tinta-suave">
          Datos del{" "}
          <a
            href="https://datos.produccion.gob.ar/dataset/sepa-precios"
            target="_blank"
            rel="noreferrer"
            className="underline underline-offset-2 hover:text-tinta-media"
          >
            SEPA (Secretaria de Comercio)
          </a>
          . Precios de referencia, pueden diferir de la gondola.
        </div>
      </footer>
    </div>
  );
}

export default Layout;
