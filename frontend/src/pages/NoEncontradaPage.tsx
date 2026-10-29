import { Link } from "react-router";
import Titular from "../components/Titular";

/*
  Una direccion que no existe (2026-10-29). Sin esta ruta, React Router mostraba
  su pantalla de error en ingles ("Unexpected Application Error! 404 Not Found")
  sin el menu del sitio: un link viejo o mal escrito dejaba a la persona sin
  salida. Va dentro del Layout, asi que el menu sigue arriba.
*/

const SECCIONES = [
  { ruta: "/", nombre: "Promos de hoy" },
  { ruta: "/canasta-personalizada", nombre: "Tu canasta" },
  { ruta: "/quien-gana", nombre: "Más barato" },
  { ruta: "/mismo-producto", nombre: "Mismo producto" },
  { ruta: "/inflacion", nombre: "Inflación" },
];

function NoEncontradaPage() {
  return (
    <>
      <Titular antetitulo="Página no encontrada" bajada={<p>Puede que el link esté mal escrito o sea de una versión anterior del sitio.</p>}>
        Esta página no existe
      </Titular>
      <nav aria-label="Secciones" className="tarjeta p-4 sm:p-6 max-w-xl">
        <p className="text-sm text-tinta-suave mb-3">Podés seguir por acá:</p>
        <ul className="space-y-1">
          {SECCIONES.map((s) => (
            <li key={s.ruta}>
              <Link to={s.ruta} className="block py-2 text-tinta font-semibold hover:underline">
                {s.nombre}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </>
  );
}

export default NoEncontradaPage;
