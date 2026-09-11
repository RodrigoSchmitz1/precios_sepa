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
        <div className="max-w-5xl mx-auto px-5 h-16 flex items-center justify-between gap-6">
          <NavLink to="/" className="flex items-baseline gap-2 shrink-0">
            <span className="font-display text-xl leading-none text-tinta">Precios</span>
            <span className="font-display text-xl leading-none italic text-ahorro">SEPA</span>
          </NavLink>

          {/*
            La nav scrollea en horizontal en pantallas chicas en vez de cortarse
            en dos lineas y empujar el contenido hacia abajo.
          */}
          <nav className="flex gap-1 overflow-x-auto -mx-1 px-1">
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
