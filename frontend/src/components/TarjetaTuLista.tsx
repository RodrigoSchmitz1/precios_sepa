import { useEffect, useState } from "react";
import { Link } from "react-router";
import { cotizarLista } from "../api/client";
import { useLista } from "../contexto/lista";
import { useZona } from "../contexto/zona";
import type { ResultadoLista } from "../types";
import { formatearPesos } from "../utils/formato";
import { vistaDeLista } from "../utils/listaEnZona";
import { cadenasVisibles } from "../utils/zona";

/*
  La portada arranca por tu lista (openspec lista-en-el-centro): si hay
  productos guardados, debajo del buscador va cuánto sale en la cadena más
  barata, con zona entre las cadenas cerca. Es el mismo pedido y la misma
  vista que Tu lista, así las dos dicen lo mismo.
*/
function TarjetaTuLista() {
  const { lista } = useLista();
  const { zona } = useZona();
  const clave = lista.length > 0 ? JSON.stringify([lista.map((i) => [i.id_producto, i.cantidad]), zona?.cadenas ?? []]) : "";
  const [estado, setEstado] = useState<{ clave: string; resultado: ResultadoLista | null } | null>(null);

  useEffect(() => {
    if (!clave) return;
    let cancelado = false;
    const [pares, cadenas] = JSON.parse(clave) as [[string, number][], string[]];
    cotizarLista(
      pares.map(([id_producto, cantidad]) => ({ id_producto, cantidad })),
      cadenas
    )
      .then((resultado) => !cancelado && setEstado({ clave, resultado }))
      .catch(() => !cancelado && setEstado({ clave, resultado: null }));
    return () => {
      cancelado = true;
    };
  }, [clave]);

  if (!clave) return null;
  const r = estado?.clave === clave ? estado.resultado : null;
  const barata = r ? vistaDeLista(r, zona ? cadenasVisibles(zona) : null).completas[0] : undefined;
  const n = lista.length;
  return (
    <Link
      to="/lista"
      className="mt-3 flex items-center justify-between gap-3 rounded-2xl bg-white/95 text-tinta px-4 py-3 shadow-flotante hover:bg-white transition-colors"
    >
      <span className="min-w-0 text-sm leading-snug">
        <span className="font-bold">🛒 Tu lista · {n} {n === 1 ? "producto" : "productos"}</span>
        {": "}
        {barata ? (
          <>
            en <strong className="font-semibold">{barata.cadena}</strong> te sale{" "}
            <strong className="font-semibold numero">{formatearPesos(barata.total)}</strong>
          </>
        ) : (
          "mirá dónde te conviene"
        )}
      </span>
      <span aria-hidden="true" className="shrink-0 text-marca font-bold">
        →
      </span>
    </Link>
  );
}

export default TarjetaTuLista;
