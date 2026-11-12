import { useEffect, useState } from "react";
import { obtenerCadenasDeOtroDia } from "../api/client";
import { textoCadenasDeOtroDia, type CadenasDeOtroDia } from "../utils/cadenasDeOtroDia";

/*
  Avisa cuando alguna cadena se muestra con precios de otro dia porque SEPA no
  la publico en el ultimo (Cencosud el 2026-11-11). Va en la portada, Mas barato
  y Mismo producto, que usan esos precios. Un dia completo no muestra nada, y si
  el pedido falla tampoco: el aviso informa, no puede tapar la pagina.
*/

// Una sola peticion por carga del sitio, compartida entre las paginas.
let pedido: Promise<CadenasDeOtroDia | null> | null = null;

function AvisoCadenasDeOtroDia({ className = "" }: { className?: string }) {
  const [datos, setDatos] = useState<CadenasDeOtroDia | null>(null);

  useEffect(() => {
    let cancelado = false;
    pedido ??= obtenerCadenasDeOtroDia().catch(() => null);
    pedido.then((d) => {
      if (!cancelado) setDatos(d);
    });
    return () => {
      cancelado = true;
    };
  }, []);

  const texto = textoCadenasDeOtroDia(datos);
  if (!texto) return null;
  return (
    <p role="status" className={`rounded-2xl bg-aviso-tenue border border-aviso/30 px-4 py-3 text-sm text-tinta ${className}`}>
      {texto}
    </p>
  );
}

export default AvisoCadenasDeOtroDia;
