import { useState } from "react";
import { useZona } from "../contexto/zona";
import { usePromosBancarias } from "../contexto/usePromosBancarias";
import type { TotalCadenaLista } from "../types";
import { formatearPesos } from "../utils/formato";
import { hoyEnArgentina } from "../utils/gastos";
import { nombreCadena } from "../utils/nombres";
import { diaDeLaSemana, fechaCorta, opcionesDeCadena, promosDelDia, type OpcionDePago } from "../utils/promosBancarias";
import { useTarjetas } from "../utils/tarjetas";
import MisTarjetas from "./MisTarjetas";

/*
  "Con que pagar hoy" en Mi compra (openspec promos-bancarias): para cada
  cadena de la zona con la lista completa, la mejor promo bancaria del dia que
  el usuario puede usar, con dos cifras separadas -lo que paga en caja y lo
  que le devuelven despues-. Canal sucursal: los precios de la lista son de
  sucursal. Lo que no se puede calcular se dice, sin inventar un monto.
*/

function Detalle({ opcion }: { opcion: OpcionDePago }) {
  const { promo, pago } = opcion;
  const fuente = (
    <span className="text-[11px] text-tinta-suave">
      {" "}
      · <a href={promo.fuente} target="_blank" rel="noreferrer" className="underline underline-offset-2">fuente</a>, revisada el{" "}
      {fechaCorta(promo.revisada)}
    </span>
  );
  if (pago.estado === "a-confirmar") {
    return (
      <p className="text-xs text-tinta-media">
        {promo.porcentaje}% con {promo.entidad}: a confirmar, {pago.motivo}.{fuente}
      </p>
    );
  }
  if (pago.estado === "falta-minimo") {
    return (
      <p className="text-xs text-tinta-media">
        {promo.porcentaje}% con {promo.entidad}: hace falta comprar {formatearPesos(pago.minimo)} o más.{fuente}
      </p>
    );
  }
  return (
    <div className="text-sm">
      <p className="text-tinta">
        Con <strong>{promo.entidad}</strong> ({promo.porcentaje}%): pagás{" "}
        <strong className="numero">{formatearPesos(pago.pagaEnCaja)}</strong> en caja
        {pago.teDevuelven > 0 && (
          <>
            {" "}y te devuelven <strong className="text-ahorro numero">{formatearPesos(pago.teDevuelven)}</strong> en 10 a 30 días
          </>
        )}
        .
      </p>
      <p className="text-xs text-tinta-suave mt-0.5">
        {pago.topeAplicado && "Llega al tope; si ya lo usaste este mes, te devuelven menos. "}
        {promo.acumula === "no_se_sabe" && "Sobre el precio de lista: puede no sumarse a las promos de góndola. "}
        {promo.acumula === "no" && "No se suma a las promos de góndola. "}
        {fuente}
      </p>
    </div>
  );
}

export default function ConQuePagar({ completas }: { completas: TotalCadenaLista[] }) {
  const estado = usePromosBancarias();
  const { zona } = useZona();
  const tarjetas = useTarjetas();
  const [eligiendo, setEligiendo] = useState(false);
  if (!zona || !estado || estado === "error" || estado.promos.length === 0 || completas.length === 0) return null;

  const dia = diaDeLaSemana(hoyEnArgentina());
  // Las promos usan los nombres de SEPA (como zona.cadenas); los totales, los de pantalla.
  const deHoy = promosDelDia(estado.promos, dia, zona.cadenas, tarjetas).map((p) => ({ ...p, cadenas: p.cadenas.map(nombreCadena) }));
  const conTarjetas = tarjetas.entidades.length > 0;
  const filas = completas
    .map((c) => ({ cadena: c, ...opcionesDeCadena(c.total, c.cadena, deHoy, tarjetas) }))
    .filter((f) => f.mejor || f.otras.length > 0);

  return (
    <details className="mb-3 border-b border-linea pb-3 group">
      <summary className="cursor-pointer list-none flex items-center justify-between min-h-11 text-base font-bold text-tinta">
        Con qué pagar hoy
        <span aria-hidden="true" className="text-marca group-open:rotate-45 transition-transform">＋</span>
      </summary>
      <p className="text-xs text-tinta-suave mt-1 mb-2">
        Promos de bancos y billeteras de hoy, en sucursal.{" "}
        <button type="button" onClick={() => setEligiendo((v) => !v)} className="font-semibold text-marca underline underline-offset-2">
          {conTarjetas ? "Cambiar mis tarjetas" : "Marcá tus tarjetas"}
        </button>
      </p>
      {eligiendo && (
        <div className="mb-3">
          <MisTarjetas promos={estado.promos} onListo={() => setEligiendo(false)} />
        </div>
      )}
      {filas.length === 0 ? (
        <p className="text-sm text-tinta-media">
          {conTarjetas ? "Hoy no hay promos con tus tarjetas en estos súper." : "Hoy no hay promos bancarias cargadas en estos súper."}
        </p>
      ) : (
        <ul className="divide-y divide-linea">
          {filas.map((f) => (
            <li key={f.cadena.cadena} className="py-2">
              <p className="flex items-baseline justify-between gap-3 text-sm font-bold text-tinta">
                <span>{f.cadena.cadena}</span>
                <span className="text-xs font-semibold text-tinta-suave numero">lista {formatearPesos(f.cadena.total)}</span>
              </p>
              <div className="mt-1 space-y-1">
                {f.mejor && <Detalle opcion={f.mejor} />}
                {f.otras.map((o) => (
                  <Detalle key={o.promo.id} opcion={o} />
                ))}
              </div>
            </li>
          ))}
        </ul>
      )}
      <p className="text-xs text-tinta-suave mt-2">Confirmá en la app de tu banco o billetera antes de pagar.</p>
    </details>
  );
}
