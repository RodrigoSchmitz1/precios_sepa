import { useEffect, useMemo, useState, type ReactNode } from "react";
import { dondeComprarLista } from "../../api/client";
import { useZona } from "../../contexto/zona";
import type { Gasto, ResultadoDondeComprar } from "../../types";
import { formatearPesos, porcentajeEntero } from "../../utils/formato";
import { compararMes, productosDelMes } from "../../utils/mesDeGastos";
import { listarConY, nombreLegible } from "../../utils/texto";
import { RADIO_CERCA_KM } from "../../utils/zona";

/*
  Con los tickets del mes: en que super de tu zona salian mas baratos esos
  mismos productos, y cuanto menos mezclando dos (openspec
  promos-navegables-y-mes-en-gastos). Se manda la lista de productos y
  cantidades, nunca los tickets; la API la cotiza en memoria.
*/
function ElMesEnTuZona({ gastos, mes, coberturaMinima }: { gastos: Gasto[]; mes: string; coberturaMinima: number | null }) {
  const { zona } = useZona();
  const datos = useMemo(() => productosDelMes(gastos, mes), [gastos, mes]);
  const [resultado, setResultado] = useState<ResultadoDondeComprar | null>(null);
  const [estado, setEstado] = useState<"cargando" | "listo" | "error">("cargando");
  const [verPartes, setVerPartes] = useState(false);

  // Sin cobertura suficiente no se pide nada: la respuesta no cambiaria lo que se dice.
  const vinculado = Object.values(datos.importes).reduce((s, x) => s + x, 0);
  const alcanza = coberturaMinima != null && datos.bruto > 0 && vinculado / datos.bruto >= coberturaMinima;
  const firma = zona && alcanza ? JSON.stringify([datos.items, zona.latitud, zona.longitud]) : "";
  const [firmaPedida, setFirmaPedida] = useState("");
  if (firma !== firmaPedida) {
    setFirmaPedida(firma);
    setResultado(null);
    setEstado("cargando");
  }

  useEffect(() => {
    if (!firma) return;
    const [items, latitud, longitud] = JSON.parse(firma);
    let cancelado = false;
    dondeComprarLista(items, latitud, longitud, RADIO_CERCA_KM)
      .then((r) => {
        if (cancelado) return;
        setResultado(r);
        setEstado("listo");
      })
      .catch(() => {
        if (!cancelado) setEstado("error");
      });
    return () => {
      cancelado = true;
    };
  }, [firma]);

  // Un mes solo con gastos a mano no tiene productos: no hay nada que comparar.
  if (datos.bruto <= 0 || coberturaMinima == null) return null;

  const caja = (contenido: ReactNode, tono = "bg-papel-hundido") => (
    <section aria-label="Tu mes en los súper de tu zona" className={`mt-5 rounded-2xl ${tono} text-tinta text-sm p-4 leading-relaxed`}>
      {contenido}
    </section>
  );

  if (!alcanza) {
    return caja(
      <p className="text-tinta-media">
        Reconocimos {porcentajeEntero(datos.bruto > 0 ? vinculado / datos.bruto : 0)} de lo que compraste este mes: no alcanza para
        decirte en qué súper te salía más barato (hace falta al menos {porcentajeEntero(coberturaMinima)}).
      </p>,
    );
  }
  if (!zona) {
    return caja(<p className="text-tinta-media">Elegí tu zona arriba y te decimos en qué súper te salía más barato lo que compraste este mes.</p>);
  }
  if (estado === "cargando") return caja(<p className="text-tinta-suave">Comparando tu mes con los súper de tu zona…</p>);
  if (estado === "error") return caja(<p className="text-tinta-suave">No pudimos comparar tu mes ahora.</p>);

  const c = compararMes(datos, resultado, coberturaMinima);
  if (c.estado === "poca-cobertura") {
    return caja(
      <p className="text-tinta-media">
        Los súper de tu zona informan precio de {porcentajeEntero(c.cobertura)} de lo que compraste: no alcanza para comparar tu mes.
      </p>,
    );
  }
  if (c.estado !== "ok") {
    return caja(<p className="text-tinta-media">Ningún súper a menos de {RADIO_CERCA_KM} km de tu zona informa precio de estos productos.</p>);
  }

  const diferencia = c.pagado - c.total;
  const cuantos = c.productos < c.productosDelMes ? `${c.productos} de tus ${c.productosDelMes} productos del mes` : `tus ${c.productos} productos del mes`;
  const sinPromos = <span className="text-tinta-suave"> A precio de lista, sin promos.</span>;

  const principal =
    c.yaEsLaMasBarata || diferencia <= 0 ? (
      <p>
        {c.yaEsLaMasBarata ? (
          <>Este mes compraste en <strong>{c.cadena}</strong>, el súper de tu zona donde {cuantos} salían más baratos.</>
        ) : (
          <>
            En <strong>{c.cadena}</strong>, el súper de tu zona más barato para {cuantos}, salían{" "}
            <strong className="numero">{formatearPesos(c.total)}</strong>: no más baratos que lo que te figuran en los tickets.
          </>
        )}
        {sinPromos}
      </p>
    ) : (
      <p>
        En <strong>{c.cadena}</strong>, {cuantos} salían <strong className="numero">{formatearPesos(c.total)}</strong>:{" "}
        <strong className="numero text-ahorro">{formatearPesos(diferencia)} menos</strong> que los{" "}
        <span className="numero">{formatearPesos(c.pagado)}</span> que te figuran en los tickets.{sinPromos}
      </p>
    );

  return caja(
    <>
      <h3 className="font-bold mb-1">Tu mes en los súper de tu zona</h3>
      {principal}
      {c.mezcla && (
        <div className="mt-3 pt-3 border-t border-linea">
          <p>
            Mezclando <strong>{listarConY(c.mezcla.partes.map((p) => p.cadena))}</strong> salían{" "}
            <strong className="numero">{formatearPesos(c.mezcla.total)}</strong>,{" "}
            <strong className="numero text-ahorro">{formatearPesos(c.mezcla.ahorroContraUna)} menos</strong> que solo en {c.cadena}.{" "}
            <button type="button" onClick={() => setVerPartes(!verPartes)} aria-expanded={verPartes} className="text-marca font-semibold underline">
              {verPartes ? "Ocultar" : "Qué llevar de cada uno"}
            </button>
          </p>
          {verPartes && (
            <div className="mt-2 grid gap-3 sm:grid-cols-2">
              {c.mezcla.partes.map((p) => (
                <div key={p.cadena}>
                  <p className="flex justify-between gap-3 font-semibold">
                    <span>
                      En {p.cadena} · {p.productos.length} {p.productos.length === 1 ? "producto" : "productos"}
                    </span>
                    <span className="numero">{formatearPesos(p.subtotal)}</span>
                  </p>
                  <ul className="mt-1 text-xs text-tinta-media space-y-0.5">
                    {p.productos.map((nombre, i) => (
                      <li key={i} className="break-words">
                        {nombreLegible(nombre, null)}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      {datos.recortados > 0 && (
        <p className="mt-2 text-xs text-tinta-suave">
          Comparamos los {datos.items.length} productos de mayor importe; quedaron afuera {datos.recortados}.
        </p>
      )}
    </>,
    "bg-marca-tenue",
  );
}

export default ElMesEnTuZona;
