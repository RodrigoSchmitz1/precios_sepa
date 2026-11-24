import { useEffect, useState } from "react";
import PromoCercana from "../PromoCercana";
import { dondeComprarLista, obtenerPromosDeProductos } from "../../api/client";
import { useZona } from "../../contexto/zona";
import type { PromoCerca, ResultadoDondeComprar } from "../../types";
import type { ProductoHabitual } from "../../utils/compraHabitual";
import { formatearPesos } from "../../utils/formato";
import { mezclaQueConviene, opcionDeDos, opcionDeUna } from "../../utils/mezclarDos";
import { listarConY, nombreLegible } from "../../utils/texto";
import { RADIO_CERCA_KM } from "../../utils/zona";

/*
  "Para tu proxima compra" (openspec mis-gastos-para-volver): con los productos
  que se repiten en tus tickets, que esta en promo cerca y donde te conviene
  comprar. Es el incentivo de Mis gastos: no se paga por ticket (ver el informe
  de paneles e incentivos del 2026-11-24), se devuelve informacion util.
  Usa los mismos endpoints en memoria que los avisos de oferta y Mi compra.
*/
function ParaTuProximaCompra({ habitual }: { habitual: ProductoHabitual[] }) {
  const { zona } = useZona();
  const [promos, setPromos] = useState<Record<string, PromoCerca[]> | null>(null);
  const [opciones, setOpciones] = useState<ResultadoDondeComprar | null>(null);
  const [error, setError] = useState(false);

  const firma = zona && habitual.length > 0 ? JSON.stringify([habitual.map((p) => [p.id_producto, p.cantidad]), zona.latitud, zona.longitud]) : "";
  const [firmaPedida, setFirmaPedida] = useState("");
  if (firma !== firmaPedida) {
    setFirmaPedida(firma);
    setPromos(null);
    setOpciones(null);
    setError(false);
  }

  useEffect(() => {
    if (!firma) return;
    const [productos, latitud, longitud] = JSON.parse(firma) as [[string, number][], number, number];
    let cancelado = false;
    obtenerPromosDeProductos(productos.map(([id]) => id), { latitud, longitud })
      .then((r) => !cancelado && setPromos(r))
      .catch(() => !cancelado && setPromos({}));
    dondeComprarLista(
      productos.map(([id_producto, cantidad]) => ({ id_producto, cantidad })),
      latitud,
      longitud,
      RADIO_CERCA_KM,
    )
      .then((r) => !cancelado && setOpciones(r))
      .catch(() => !cancelado && setError(true));
    return () => {
      cancelado = true;
    };
  }, [firma]);

  if (habitual.length === 0) return null;

  if (!zona) {
    return (
      <section aria-label="Para tu próxima compra" className="tarjeta p-5 mb-6 text-sm text-tinta-media">
        <h2 className="text-lg font-bold text-tinta mb-1">Para tu próxima compra</h2>
        Elegí tu zona arriba y te decimos qué de lo que comprás seguido está en promo cerca y en qué súper te conviene.
      </section>
    );
  }

  const enPromo = promos ? habitual.filter((p) => (promos[p.id_producto] ?? []).length > 0) : [];
  const una = opciones ? opcionDeUna(opciones.opciones) : undefined;
  const mezcla = una && opciones ? mezclaQueConviene(una, opcionDeDos(opciones.opciones)) : null;

  return (
    <section aria-labelledby="titulo-proxima-compra" className="tarjeta p-5 sm:p-6 mb-6">
      <h2 id="titulo-proxima-compra" className="text-lg font-bold text-tinta">
        Para tu próxima compra
      </h2>
      <p className="text-xs text-tinta-suave mb-3">
        Con lo que comprás seguido: {habitual.length} productos que se repiten en tus tickets de los últimos 3 meses.
      </p>

      {promos === null && <p className="text-sm text-tinta-suave">Buscando promos cerca…</p>}
      {promos && enPromo.length > 0 && (
        <div className="mb-4">
          <h3 className="text-sm font-bold text-ahorro mb-2">
            🔥 {enPromo.length === 1 ? "1 cosa que comprás seguido está en promo cerca" : `${enPromo.length} cosas que comprás seguido están en promo cerca`}
          </h3>
          <ul className="space-y-3">
            {enPromo.slice(0, 5).map((p) => (
              <li key={p.id_producto}>
                <p className="text-sm font-semibold text-tinta">{nombreLegible(p.descripcion, null)}</p>
                <PromoCercana promo={promos[p.id_producto][0]} />
              </li>
            ))}
          </ul>
          {enPromo.length > 5 && <p className="mt-2 text-xs text-tinta-suave">Y {enPromo.length - 5} más.</p>}
        </div>
      )}

      {error && <p className="text-sm text-tinta-suave">No pudimos ver dónde te conviene ahora.</p>}
      {opciones && !una && (
        <p className="text-sm text-tinta-media">Ningún súper a menos de {RADIO_CERCA_KM} km tiene precio para lo que comprás seguido.</p>
      )}
      {una && (
        <div className="rounded-2xl bg-marca-tenue p-4 text-sm text-tinta leading-relaxed">
          <p>
            Tu compra habitual sale menos en <strong>{una.sucursales[0].cadena}</strong>:{" "}
            <strong className="numero">{formatearPesos(una.total)}</strong>
            {una.productos_cubiertos < habitual.length && (
              <span className="text-tinta-media">
                {" "}
                ({una.productos_cubiertos} de {habitual.length} productos)
              </span>
            )}
            .
          </p>
          {mezcla && (
            <p className="mt-1">
              Mezclando <strong>{listarConY(mezcla.partes.map((m) => m.cadena))}</strong>:{" "}
              <strong className="numero">{formatearPesos(mezcla.total)}</strong>,{" "}
              <strong className="numero text-ahorro">{formatearPesos(mezcla.ahorroContraUna)} menos</strong>.
            </p>
          )}
          <p className="mt-1 text-xs text-tinta-suave">A precio de lista, sin promos, en súper a menos de {RADIO_CERCA_KM} km de tu zona.</p>
        </div>
      )}
    </section>
  );
}

export default ParaTuProximaCompra;
