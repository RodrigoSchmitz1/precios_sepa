import { useEffect, useState } from "react";
import { cotizarLista } from "../api/client";
import { useLista } from "../contexto/lista";
import { useZona } from "../contexto/zona";
import type { ItemLista } from "../types";
import { formatearPesos } from "../utils/formato";
import { vistaDeLista } from "../utils/listaEnZona";
import { nombreParaLista } from "../utils/nombreParaLista";
import { cadenasVisibles, rotuloZona } from "../utils/zona";

/*
  Una lista que llego por un link (openspec compartir-y-pegar-la-lista). Se
  muestra cotizada en la zona de quien la abre y NO toca la lista guardada hasta
  que la persona elija: sin lista propia se guarda directo; con lista, sumar o
  reemplazar (lo decidio Rodrigo).
*/
type Recibido = { id_producto: string; cantidad: number };

type Estado =
  | { tipo: "cargando" }
  | { tipo: "error" }
  | { tipo: "lista"; items: ItemLista[]; omitidos: number; barata: { cadena: string; total: number } | null };

function ListaRecibida({ recibidos, onListo }: { recibidos: Recibido[]; onListo: () => void }) {
  const { lista, sumar, reemplazar } = useLista();
  const { zona } = useZona();
  const [estado, setEstado] = useState<Estado>({ tipo: "cargando" });
  // Si no habia lista propia al abrir el link, se guarda directo (una vez).
  const [teniaLista] = useState(lista.length > 0);
  const claveZona = zona ? JSON.stringify(zona.cadenas) : "";

  useEffect(() => {
    let cancelado = false;
    const cadenas = claveZona ? (JSON.parse(claveZona) as string[]) : undefined;
    cotizarLista(recibidos, cadenas)
      .then((r) => {
        if (cancelado) return;
        const porId = new Map(r.productos.map((p) => [p.id_producto, p]));
        const items: ItemLista[] = recibidos.flatMap((x) => {
          const p = porId.get(x.id_producto);
          return p ? [{ id_producto: x.id_producto, nombre: nombreParaLista(p), cantidad: x.cantidad, categoria: p.categoria ?? undefined }] : [];
        });
        const barata = vistaDeLista(r, zona ? cadenasVisibles(zona) : null).completas[0] ?? null;
        setEstado({ tipo: "lista", items, omitidos: recibidos.length - items.length, barata });
      })
      .catch(() => {
        if (!cancelado) setEstado({ tipo: "error" });
      });
    return () => {
      cancelado = true;
    };
    // zona entra por claveZona: un objeto nuevo con las mismas cadenas no recotiza.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recibidos, claveZona]);

  useEffect(() => {
    if (estado.tipo === "lista" && !teniaLista && estado.items.length > 0) {
      reemplazar(estado.items);
      onListo();
    }
  }, [estado, teniaLista, reemplazar, onListo]);

  if (estado.tipo === "cargando") {
    return <section className="tarjeta p-5 mb-6 text-tinta-media">Abriendo la lista que te compartieron…</section>;
  }
  if (estado.tipo === "error") {
    return (
      <section className="tarjeta p-5 mb-6">
        <p className="text-tinta">No pudimos abrir la lista que te compartieron. Probá de nuevo en un rato.</p>
        <button onClick={onListo} className="mt-3 text-sm underline underline-offset-2 text-tinta-media">
          Cerrar
        </button>
      </section>
    );
  }
  if (estado.items.length === 0) {
    return (
      <section className="tarjeta p-5 mb-6">
        <p className="text-tinta">Los productos de esa lista ya no tienen precio. No hay nada para sumar.</p>
        <button onClick={onListo} className="mt-3 text-sm underline underline-offset-2 text-tinta-media">
          Cerrar
        </button>
      </section>
    );
  }
  if (!teniaLista) return null;

  const { items, omitidos, barata } = estado;
  return (
    <section aria-labelledby="titulo-recibida" className="tarjeta p-5 sm:p-6 mb-6 border-2 border-marca">
      <h2 id="titulo-recibida" className="text-lg font-bold text-tinta">
        Te compartieron una lista de {items.length} {items.length === 1 ? "producto" : "productos"}
      </h2>
      {barata && (
        <p className="text-base text-tinta mt-1">
          {zona ? `En tu zona (${rotuloZona(zona)}), en` : "En"} <strong className="font-semibold">{barata.cadena}</strong> sale{" "}
          <strong className="font-semibold numero">{formatearPesos(barata.total)}</strong>
        </p>
      )}
      <ul className="mt-3 text-sm text-tinta-media space-y-0.5">
        {items.map((i) => (
          <li key={i.id_producto}>
            {i.cantidad} × {i.nombre}
          </li>
        ))}
      </ul>
      {omitidos > 0 && (
        <p className="text-xs text-aviso mt-2">
          {omitidos === 1 ? "Un producto de la lista ya no tiene precio y" : `${omitidos} productos de la lista ya no tienen precio y`} no se suma
          {omitidos === 1 ? "" : "n"}.
        </p>
      )}
      <p className="text-sm text-tinta mt-4">Ya tenés una lista guardada con {lista.length} productos. ¿Qué hacemos?</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          onClick={() => {
            sumar(items);
            onListo();
          }}
          className="fondo-marca text-white text-sm font-bold rounded-xl px-4 py-2.5"
        >
          Sumar a mi lista
        </button>
        <button
          onClick={() => {
            reemplazar(items);
            onListo();
          }}
          className="rounded-xl border border-linea text-tinta text-sm font-medium px-4 py-2.5 hover:border-tinta"
        >
          Reemplazar mi lista
        </button>
        <button onClick={onListo} className="text-sm text-tinta-media underline underline-offset-2 px-2">
          No, gracias
        </button>
      </div>
    </section>
  );
}

export default ListaRecibida;
