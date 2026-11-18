import { useEffect, useState } from "react";
import { compartir, type DatosParaCompartir } from "../utils/compartir";

/*
  El boton "Compartir" (openspec compartir-por-whatsapp). Los datos se piden al
  tocar y no al renderizar: el texto sale del titular ya pintado en la pagina,
  asi dice exactamente lo mismo que la pantalla, con la zona si la hay.
*/
function BotonCompartir({ datos }: { datos: () => DatosParaCompartir }) {
  const [estado, setEstado] = useState<"" | "copiado" | "fallo">("");
  const [link, setLink] = useState("");

  useEffect(() => {
    if (estado !== "copiado") return;
    const espera = window.setTimeout(() => setEstado(""), 2500);
    return () => window.clearTimeout(espera);
  }, [estado]);

  async function tocar() {
    const d = datos();
    const resultado = await compartir(d);
    if (resultado === "copiado" || resultado === "fallo") {
      setLink(d.url);
      setEstado(resultado);
    }
  }

  return (
    <span className="inline-flex flex-col gap-1 min-w-0">
      <button
        onClick={tocar}
        aria-live="polite"
        className="shrink-0 rounded-full border border-linea text-tinta-media hover:border-tinta hover:text-tinta transition-colors text-sm px-4 py-2 font-medium"
      >
        {estado === "copiado" ? "✓ Link copiado" : "Compartir"}
      </button>
      {estado === "fallo" && (
        <span className="text-xs text-tinta-suave break-all">
          Copiá este link: <span className="select-all">{link}</span>
        </span>
      )}
    </span>
  );
}

export default BotonCompartir;
