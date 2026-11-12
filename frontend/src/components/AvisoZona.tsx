import { useZona } from "../contexto/zona";

/*
  Un aviso sobre la zona que no depende de ninguna pagina: por ejemplo, un link
  compartido con una zona que ya no tiene sucursales (zona compartida, 2026-11).
*/
function AvisoZona() {
  const { aviso, cerrarAviso } = useZona();
  if (!aviso) return null;
  return (
    <div role="status" className="max-w-6xl mx-auto mb-6 flex items-start justify-between gap-3 rounded-2xl bg-aviso-tenue border border-aviso/30 px-4 py-3 text-sm text-tinta">
      <span>{aviso}</span>
      <button type="button" onClick={cerrarAviso} className="shrink-0 text-tinta-suave underline underline-offset-2">
        Cerrar
      </button>
    </div>
  );
}

export default AvisoZona;
