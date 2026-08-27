import { Outlet, NavLink } from "react-router";

const SECCIONES = [
  { ruta: "/", nombre: "Promos" },
  { ruta: "/canasta", nombre: "Canasta basica" },
  { ruta: "/quien-gana", nombre: "Quien gana" },
  { ruta: "/inflacion", nombre: "Inflacion" },
];

function Layout() {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <nav className="max-w-3xl mx-auto px-4 py-4 flex gap-6">
          {SECCIONES.map((seccion) => (
            <NavLink
              key={seccion.ruta}
              to={seccion.ruta}
              end={seccion.ruta === "/"}
              className={({ isActive }) =>
                isActive
                  ? "text-green-600 font-semibold text-sm"
                  : "text-gray-500 hover:text-gray-900 text-sm"
              }
            >
              {seccion.nombre}
            </NavLink>
          ))}
        </nav>
      </header>

      <main className="py-10 px-4">
        <Outlet />
      </main>
    </div>
  );
}

export default Layout;
