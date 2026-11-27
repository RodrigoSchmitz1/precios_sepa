import { useState } from "react";
import { useLista } from "../contexto/lista";
import { gruposDeLista } from "../utils/ejemploDeCompra";

/**
 * "Ver un ejemplo" (app-para-el-usuario): con la lista vacia, la compra de
 * ejemplo se pide con un toque en vez de cargarse sola. Si no se puede armar,
 * lo dice y la pagina sigue con el armado rapido.
 */
export function BotonVerEjemplo({ className = "", claro = false }: { className?: string; claro?: boolean }) {
  const { verEjemplo } = useLista();
  const [estado, setEstado] = useState<"listo" | "cargando" | "error">("listo");
  return (
    <span className={`inline-flex flex-col items-start gap-1 ${className}`}>
      <button
        type="button"
        disabled={estado === "cargando"}
        onClick={async () => {
          setEstado("cargando");
          setEstado((await verEjemplo()) ? "listo" : "error");
        }}
        className={`rounded-xl px-4 py-2.5 text-sm font-bold min-h-11 disabled:opacity-60 ${
          claro ? "bg-papel text-tinta border border-linea-fuerte hover:border-marca" : "fondo-marca text-white"
        }`}
      >
        {estado === "cargando" ? "Armando el ejemplo…" : "Ver un ejemplo"}
      </button>
      {estado === "error" && (
        <span role="alert" className="text-xs text-alerta">
          No se pudo armar el ejemplo ahora. Probá armar tu lista con los básicos.
        </span>
      )}
    </span>
  );
}

/*
  El cartel de la compra de ejemplo en Mi compra (openspec
  ejemplo-para-empezar): avisa que la lista es un ejemplo y deja sacarla entera
  o de a un grupo. Sumar un producto propio la reemplaza; quitar uno o cambiar
  una cantidad la hace propia (app-para-el-usuario). El cartel se va solo.
*/
function EjemploDeCompra() {
  const { esEjemplo, borrarEjemplo, quitarGrupo, lista } = useLista();
  if (!esEjemplo) return null;
  const grupos = gruposDeLista(lista);
  return (
    <section className="tarjeta p-5 sm:p-6 mb-6 border-l-4 border-marca" aria-label="Lista de ejemplo">
      <p className="text-xs font-bold uppercase tracking-wide text-marca mb-1">Lista de ejemplo</p>
      <h2 className="text-lg font-bold text-tinta mb-1">Así se ve con tu compra</h2>
      <p className="text-sm text-tinta-media mb-4">
        Son {lista.length} productos comunes con los precios de hoy. Sacá lo que no comprás o borrala y armá la tuya:
        el primer producto que sumes reemplaza al ejemplo.
      </p>
      {grupos.length > 1 && (
        <ul className="flex flex-wrap gap-2 mb-4" aria-label="Sacar un grupo">
          {grupos.map((g) => (
            <li key={g}>
              <button
                type="button"
                onClick={() => quitarGrupo(g)}
                aria-label={`Sacar ${g}`}
                className="rounded-full border border-linea bg-papel px-3.5 py-2 text-sm font-medium text-tinta hover:border-marca-borde"
              >
                {g} <span aria-hidden="true">×</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <button
        type="button"
        onClick={borrarEjemplo}
        className="rounded-xl border border-linea-fuerte px-4 py-2.5 text-sm font-bold text-tinta hover:border-marca"
      >
        Borrar el ejemplo
      </button>
    </section>
  );
}

export default EjemploDeCompra;
