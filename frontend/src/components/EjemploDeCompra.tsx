import { useLista } from "../contexto/lista";
import { gruposDeLista } from "../utils/ejemploDeCompra";

/*
  El cartel de la compra de ejemplo en Mi compra (openspec
  ejemplo-para-empezar): avisa que la lista es un ejemplo y deja sacarla entera
  o de a un grupo. Sumar, quitar o cambiar una cantidad la hace propia y el
  cartel se va solo.
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
        apenas cambies algo pasa a ser tu lista.
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
