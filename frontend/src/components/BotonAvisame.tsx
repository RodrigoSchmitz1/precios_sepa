import { useState } from "react";
import { alternarAviso, MAXIMO_AVISOS, useAvisos, type ResultadoAviso } from "../utils/avisos";
import { hoyEnArgentina } from "../utils/gastos";
import { senal } from "../utils/senales";
import { useZona } from "../contexto/zona";

/*
  "Avisame cuando este de oferta" (openspec promos-navegables-y-mes-en-gastos).

  Es el unico lugar donde se pide un aviso: el detalle de un producto y cada
  promo de una pagina de categoria usan este boton. Cuando se enciendan las
  senales anonimas para Changuito Empresas, se instrumenta aca y en ningun
  otro lado.
*/
function BotonAvisame({
  producto,
  compacto = false,
}: {
  producto: { id_producto: string; descripcion: string };
  compacto?: boolean;
}) {
  const avisos = useAvisos();
  const { zona } = useZona();
  const [problema, setProblema] = useState<Extract<ResultadoAviso, "tope" | "sin-guardar"> | null>(null);
  const activo = avisos.some((a) => a.id_producto === producto.id_producto);
  const lleno = !activo && avisos.length >= MAXIMO_AVISOS;

  function tocar() {
    const resultado = alternarAviso(producto, hoyEnArgentina());
    setProblema(resultado === "tope" || resultado === "sin-guardar" ? resultado : null);
    // Señal anonima (openspec senales-anonimas): este boton es el unico lugar donde se pide un aviso.
    if (resultado === "agregado") senal({ tipo: "aviso_pedido", id_producto: producto.id_producto }, zona);
    if (resultado === "sacado") senal({ tipo: "aviso_quitado", id_producto: producto.id_producto }, zona);
  }

  const texto = activo ? "🔔 Te avisamos" : compacto ? "🔔 Avisame" : "🔔 Avisame cuando esté de oferta";
  return (
    <span className="inline-flex flex-col items-start gap-1">
      <button
        type="button"
        onClick={tocar}
        aria-pressed={activo}
        title={activo ? "Tocá para dejar de avisarte" : "Te avisamos acá cuando esté en promo cerca de tu zona"}
        className={`shrink-0 rounded-full border transition-colors ${
          compacto ? "text-xs px-2.5 py-1 min-h-[28px]" : "text-sm px-4 py-2 font-medium"
        } ${activo ? "border-ahorro-borde bg-ahorro-tenue text-ahorro" : "border-linea-fuerte text-tinta-media hover:bg-papel-hundido"}`}
      >
        {texto}
      </button>
      {(problema === "tope" || lleno) && problema !== "sin-guardar" && (
        <span role="status" className="text-xs text-tinta-suave">
          Llegaste al tope de {MAXIMO_AVISOS} avisos: sacá alguno desde Promos para sumar otro.
        </span>
      )}
      {problema === "sin-guardar" && (
        <span role="status" className="text-xs text-alerta">
          Este navegador no deja guardar el aviso (¿modo incógnito?).
        </span>
      )}
    </span>
  );
}

export default BotonAvisame;
