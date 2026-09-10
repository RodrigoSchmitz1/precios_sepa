import { useId, useState } from "react";
import type { CategoriaCanasta } from "../types";

/*
  Buscador para sumar a la canasta una categoria que la IA no propuso.

  Antes solo se podia quitar y restaurar lo que habia armado el modelo: si no
  incluia el cerdo o los panales, no habia forma de agregarlos. Cada categoria
  llega con la unidad en la que se cotiza y una cantidad sugerida, asi que lo que
  se agrega a mano siempre se puede calcular.

  La busqueda ignora acentos y mayusculas: las categorias estan escritas sin
  tildes ("Panales", "Cafe") y alguien va a tipear "pañales" o "café".
*/

function normalizar(texto: string): string {
  return texto.normalize("NFD").replace(/\p{Mn}/gu, "").toLowerCase();
}

const MAXIMO_SUGERENCIAS = 8;

type Props = {
  /** Las que todavia no estan en la canasta. */
  categorias: CategoriaCanasta[];
  onAgregar: (categoria: CategoriaCanasta) => void;
  etiqueta: string;
};

function AgregarCategoria({ categorias, onAgregar, etiqueta }: Props) {
  const [texto, setTexto] = useState("");
  const idCampo = useId();
  const consulta = normalizar(texto.trim());
  const coincidencias = consulta
    ? categorias.filter((c) => normalizar(c.categoria).includes(consulta)).slice(0, MAXIMO_SUGERENCIAS)
    : [];

  return (
    <div>
      <label htmlFor={idCampo} className="block text-xs text-tinta-suave mb-1.5">
        {etiqueta}
      </label>
      <input
        id={idCampo}
        type="search"
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        placeholder="Buscar: cerdo, yerba, pañales…"
        autoComplete="off"
        className="w-full bg-papel border border-linea rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-ahorro"
      />

      {consulta && coincidencias.length === 0 && (
        <p className="mt-2 text-xs text-tinta-suave">
          No hay otra categoria con ese nombre para agregar.
        </p>
      )}

      {coincidencias.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {coincidencias.map((c) => (
            <button
              key={c.categoria}
              onClick={() => {
                onAgregar(c);
                setTexto("");
              }}
              className="text-xs text-tinta-media bg-papel border border-linea rounded-full px-3 py-1 hover:border-ahorro hover:text-ahorro transition-colors"
            >
              + {c.categoria}
              <span className="text-tinta-suave"> · {c.unidad}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default AgregarCategoria;
