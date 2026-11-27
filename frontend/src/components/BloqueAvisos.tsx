import { useEffect, useState } from "react";
import { Link } from "react-router";
import PromoCercana from "./PromoCercana";
import { obtenerPromosDeProductos } from "../api/client";
import type { PromoCerca } from "../types";
import type { Zona } from "../utils/zona";
import { sacarAviso, useAvisos } from "../utils/avisos";
import { compraHabitual } from "../utils/compraHabitual";
import { hoyEnArgentina, leerGastos } from "../utils/gastos";
import { leerSilenciados, silenciar, vigilados } from "../utils/vigilados";
import { nombreLegible } from "../utils/texto";

/*
  Al volver, la app dice cuales de tus avisos estan de oferta cerca (openspec
  promos-navegables-y-mes-en-gastos). Las promos salen de /promos/productos,
  la misma busqueda que el detalle de cada producto: lo que dice este bloque y
  lo que dice el detalle no pueden diferir.

  Desde app-para-el-usuario, lo que compras seguido (la compra habitual de
  Mis gastos) entra solo, marcado como tal y con "Silenciar".
*/
function BloqueAvisos({ zona }: { zona: Zona | null }) {
  const pedidos = useAvisos();
  const [habitual] = useState(() => compraHabitual(leerGastos(), hoyEnArgentina()));
  const [silenciados, setSilenciados] = useState(leerSilenciados);
  const avisos = vigilados(pedidos, habitual, silenciados);
  const [promos, setPromos] = useState<Record<string, PromoCerca[]> | null>(null);
  const [abierta, setAbierta] = useState(false);
  const ids = avisos.map((a) => a.id_producto).join(",");

  const firma = zona && ids ? `${zona.latitud},${zona.longitud}|${ids}` : "";
  const [firmaPedida, setFirmaPedida] = useState("");
  if (firma !== firmaPedida) {
    setFirmaPedida(firma);
    setPromos(null);
  }

  useEffect(() => {
    if (!firma || !zona) return;
    let cancelado = false;
    obtenerPromosDeProductos(ids.split(","), zona)
      .then((r) => {
        if (!cancelado) setPromos(r);
      })
      // Sin promos de los avisos el resto de la vidriera sigue: no vale un cartel.
      .catch(() => {
        if (!cancelado) setPromos({});
      });
    return () => {
      cancelado = true;
    };
  }, [firma, ids, zona]);

  if (avisos.length === 0) return null;

  const enOferta = promos ? avisos.filter((a) => (promos[a.id_producto] ?? []).length > 0) : [];
  const cantidad = avisos.length === 1 ? "1 aviso" : `${avisos.length} avisos`;
  const quitar = (a: (typeof avisos)[number]) => (a.seguido ? setSilenciados(silenciar(a.id_producto)) : sacarAviso(a.id_producto));

  const lista = abierta && (
    <ul className="mt-3 divide-y divide-linea border-t border-linea">
      {avisos.map((a) => (
        <li key={a.id_producto} className="flex items-center justify-between gap-3 py-2 text-sm">
          <Link to={`/mismo-producto?p=${encodeURIComponent(a.id_producto)}`} className="min-w-0 truncate text-tinta hover:text-marca">
            {nombreLegible(a.descripcion, null)}
          </Link>
          <button
            type="button"
            onClick={() => quitar(a)}
            className="shrink-0 text-xs text-tinta-suave hover:text-alerta px-2 py-1"
            aria-label={`${a.seguido ? "Silenciar" : "Dejar de avisar"} ${a.descripcion}`}
          >
            {a.seguido ? "Silenciar" : "Sacar"}
          </button>
        </li>
      ))}
    </ul>
  );
  const botonLista = (
    <button type="button" onClick={() => setAbierta(!abierta)} aria-expanded={abierta} className="text-xs text-tinta-media hover:text-marca underline">
      {abierta ? (avisos.length === 1 ? "Ocultar tu aviso" : "Ocultar tus avisos") : avisos.length === 1 ? "Ver tu aviso" : `Ver tus ${cantidad}`}
    </button>
  );

  if (!zona) {
    return (
      <section aria-label="Tus avisos" className="mb-6 text-sm text-tinta-media bg-papel-hundido rounded-xl px-4 py-3">
        <p>
          Tenés {cantidad}. Elegí tu zona arriba y te decimos cuáles están de oferta cerca. {botonLista}
        </p>
        {lista}
      </section>
    );
  }
  if (promos === null) return null;

  if (enOferta.length === 0) {
    return (
      <section aria-label="Tus avisos" className="mb-6 text-xs text-tinta-suave">
        <p>
          🔔 Tenés {cantidad}: todavía {avisos.length === 1 ? "no está" : "no están"} de oferta cerca. {botonLista}
        </p>
        {lista}
      </section>
    );
  }

  return (
    <section aria-labelledby="titulo-avisos" className="mb-8 tarjeta p-4 border border-ahorro-borde">
      <h2 id="titulo-avisos" className="font-bold text-tinta">
        🔔 {enOferta.length === 1 ? "1 de tus avisos está de oferta cerca" : `${enOferta.length} de tus avisos están de oferta cerca`}
      </h2>
      <ul className="mt-3 space-y-3">
        {enOferta.map((a) => (
          <li key={a.id_producto}>
            <p className="flex flex-wrap items-baseline gap-x-2">
              <Link to={`/mismo-producto?p=${encodeURIComponent(a.id_producto)}`} className="text-sm font-semibold text-tinta hover:text-marca">
                {nombreLegible(a.descripcion, null)}
              </Link>
              {a.seguido && (
                <>
                  <span className="text-xs font-semibold text-marca">lo comprás seguido</span>
                  <button type="button" onClick={() => quitar(a)} className="text-xs text-tinta-suave underline min-h-8" aria-label={`Silenciar ${a.descripcion}`}>
                    Silenciar
                  </button>
                </>
              )}
            </p>
            <PromoCercana promo={promos[a.id_producto][0]} />
          </li>
        ))}
      </ul>
      <p className="mt-3">{botonLista}</p>
      {lista}
    </section>
  );
}

export default BloqueAvisos;
