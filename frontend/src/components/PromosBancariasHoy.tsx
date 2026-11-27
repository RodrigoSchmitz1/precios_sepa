import { useState } from "react";
import { useZona } from "../contexto/zona";
import { usePromosBancarias } from "../contexto/usePromosBancarias";
import type { PromoBancaria } from "../types";
import { formatearPesos } from "../utils/formato";
import { hoyEnArgentina } from "../utils/gastos";
import { nombreCadena } from "../utils/nombres";
import { condicionesDePromo, diaDeLaSemana, fechaCorta, nombreDia, promosDelDia, proximoDiaConPromos } from "../utils/promosBancarias";
import { useTarjetas } from "../utils/tarjetas";
import MisTarjetas from "./MisTarjetas";

/*
  "Promos bancarias de hoy" en la portada (openspec promos-bancarias): las de
  las cadenas de tu zona, con chips Hoy y Mañana. Cada una dice de que pagina
  sale y cuando se reviso. Va debajo de las promos del dia, para no sacar su
  titulo de la primera pantalla.
*/

function nombreFuente(url: string): string {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    return host.split(".")[0] === "diaonline" ? "Día" : host.split(".")[0].replace(/^./, (c) => c.toUpperCase());
  } catch {
    return "la cadena";
  }
}

function TarjetaPromoBancaria({ promo, cadenasZona }: { promo: PromoBancaria; cadenasZona: string[] | null }) {
  const cadenas = cadenasZona ? promo.cadenas.filter((c) => cadenasZona.includes(c)) : promo.cadenas;
  return (
    <li className="rounded-2xl border border-linea bg-papel p-3 flex flex-col gap-1 min-w-0">
      <p className="text-xs font-bold text-tinta-media truncate">{cadenas.map(nombreCadena).join(", ")}</p>
      <p className="flex items-baseline gap-2">
        <span className="text-2xl font-extrabold text-ahorro numero">{promo.porcentaje}%</span>
        <span className="text-sm font-bold text-tinta min-w-0 truncate">{promo.entidad}</span>
      </p>
      <p className="text-xs text-tinta-media">{condicionesDePromo(promo, formatearPesos)}</p>
      {promo.nota && <p className="text-xs text-tinta-suave">{promo.nota}</p>}
      <p className="text-[11px] text-tinta-suave mt-auto pt-1">
        Fuente:{" "}
        <a href={promo.fuente} target="_blank" rel="noreferrer" className="underline underline-offset-2">
          página de {nombreFuente(promo.fuente)}
        </a>{" "}
        · revisada el {fechaCorta(promo.revisada)}
      </p>
    </li>
  );
}

export default function PromosBancariasHoy() {
  const estado = usePromosBancarias();
  // Hasta saber si hay zona guardada no se muestra: si no, aparecian un instante
  // las promos de todas las cadenas y "Elegi tu zona".
  const { zona, lista: zonaLista } = useZona();
  const tarjetas = useTarjetas();
  const [manana, setManana] = useState(false);
  const [verTodas, setVerTodas] = useState(false);
  const [eligiendo, setEligiendo] = useState(false);
  if (!zonaLista || !estado || estado === "error" || estado.promos.length === 0) return null;

  const hoy = hoyEnArgentina();
  const dia = diaDeLaSemana(hoy, manana ? 1 : 0);
  const cadenasZona = zona ? zona.cadenas : null;
  const conTarjetas = tarjetas.entidades.length > 0;
  const lista = promosDelDia(estado.promos, dia, cadenasZona, tarjetas, !verTodas);
  const proximo = lista.length === 0 ? proximoDiaConPromos(estado.promos, hoy, cadenasZona, verTodas ? null : tarjetas) : null;

  return (
    <section aria-labelledby="titulo-promos-bancarias" className="mt-10">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2 mb-3">
        <h2 id="titulo-promos-bancarias" className="font-display text-2xl text-tinta">
          Promos bancarias {manana ? "de mañana" : "de hoy"}
        </h2>
        <div className="flex gap-2" role="group" aria-label="Día">
          {[
            [false, "Hoy"],
            [true, "Mañana"],
          ].map(([valor, texto]) => (
            <button
              key={String(texto)}
              type="button"
              aria-pressed={manana === valor}
              onClick={() => setManana(valor as boolean)}
              className={`rounded-full min-h-10 px-4 text-sm font-semibold border ${
                manana === valor ? "bg-tinta text-white border-tinta" : "bg-papel text-tinta-media border-linea"
              }`}
            >
              {texto}
            </button>
          ))}
        </div>
      </div>
      <p className="text-sm text-tinta-media mb-3">
        {zona ? `En los súper cerca de tu zona, el ${nombreDia(dia)}.` : "Elegí tu zona arriba para ver las de los súper que tenés cerca."}{" "}
        {conTarjetas ? (
          <button type="button" onClick={() => setVerTodas((v) => !v)} className="font-semibold text-marca underline underline-offset-2">
            {verTodas ? "Ver solo las de mis tarjetas" : "Ver todas"}
          </button>
        ) : null}{" "}
        <button type="button" onClick={() => setEligiendo((v) => !v)} className="font-semibold text-marca underline underline-offset-2">
          {conTarjetas ? "Cambiar mis tarjetas" : "Marcá tus tarjetas"}
        </button>
      </p>
      {eligiendo && (
        <div className="mb-4">
          <MisTarjetas promos={estado.promos} onListo={() => setEligiendo(false)} />
        </div>
      )}
      {lista.length > 0 ? (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {lista.map((p) => (
            <TarjetaPromoBancaria key={p.id} promo={p} cadenasZona={cadenasZona} />
          ))}
        </ul>
      ) : (
        <p className="text-sm text-tinta-media">
          {conTarjetas && !verTodas ? "Con tus tarjetas no hay promos ese día" : "No hay promos cargadas ese día"}
          {proximo ? `: la próxima es el ${nombreDia(proximo.dia)}.` : "."}
        </p>
      )}
      <p className="text-xs text-tinta-suave mt-3">
        Las promos cambian seguido: confirmá en la app de tu banco o billetera antes de pagar.
      </p>
    </section>
  );
}
