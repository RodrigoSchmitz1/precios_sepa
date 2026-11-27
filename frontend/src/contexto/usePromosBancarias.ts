import { useEffect, useState } from "react";
import { obtenerPromosBancarias } from "../api/client";
import type { PromoBancaria } from "../types";

/*
  Las promos bancarias se piden una vez por visita (openspec promos-bancarias):
  la portada y Mi compra comparten el mismo pedido. Son pocas y no dependen del
  usuario, asi que no viaja ni la zona ni las tarjetas.
*/
type Estado = { promos: PromoBancaria[]; revisadasHasta: string | null } | "error" | null;

let pedido: Promise<{ promos: PromoBancaria[]; revisadas_hasta: string | null }> | null = null;

export function reiniciarPromosBancariasParaTests() {
  pedido = null;
}

export function usePromosBancarias(): Estado {
  const [estado, setEstado] = useState<Estado>(null);
  useEffect(() => {
    let cancelado = false;
    pedido ??= Promise.resolve().then(() => obtenerPromosBancarias());
    pedido
      .then((r) => !cancelado && setEstado({ promos: r.promos, revisadasHasta: r.revisadas_hasta }))
      .catch(() => {
        pedido = null;
        if (!cancelado) setEstado("error");
      });
    return () => {
      cancelado = true;
    };
  }, []);
  return estado;
}
