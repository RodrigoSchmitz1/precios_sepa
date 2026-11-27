import { useLista } from "../contexto/lista";

/*
  Cuando un producto propio reemplaza a la compra de ejemplo
  (app-para-el-usuario), unos segundos de "Deshacer" por si el usuario queria
  sumarlo a lo que habia. Va arriba de la barra del celular.
*/
function AvisoDeshacer() {
  const { deshacer } = useLista();
  if (!deshacer) return null;
  return (
    <div
      role="status"
      className="fixed inset-x-3 bottom-[calc(84px+env(safe-area-inset-bottom))] sm:bottom-6 sm:left-auto sm:right-6 sm:w-96 z-[1400] rounded-2xl bg-tinta text-white px-4 py-3 flex items-center justify-between gap-3 shadow-flotante"
    >
      <span className="text-sm">Sacamos el ejemplo: tu lista empieza con lo que sumaste.</span>
      <button type="button" onClick={deshacer} className="shrink-0 text-sm font-bold underline underline-offset-2 min-h-11 px-1">
        Deshacer
      </button>
    </div>
  );
}

export default AvisoDeshacer;
