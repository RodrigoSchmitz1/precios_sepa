import { useEffect, useState } from "react";
import { Link } from "react-router";
import { cotizarLista } from "../api/client";
import { useLista } from "../contexto/lista";
import { useZona } from "../contexto/zona";
import type { ResultadoLista } from "../types";
import { formatearPesos } from "../utils/formato";
import { hoyEnArgentina } from "../utils/gastos";
import { cifraDeLista, vistaDeLista } from "../utils/listaEnZona";
import { cambioDeLaSemana, guardarRegistroSemana, huellaDeLista, leerRegistroSemana, lunesDe, registrarSemana } from "../utils/listaSemana";
import { cadenasVisibles } from "../utils/zona";
import { BotonVerEjemplo } from "./EjemploDeCompra";

/*
  La tarjeta de tu compra, debajo del buscador de la portada (openspec
  app-para-el-usuario; antes lista-en-el-centro). Una sola cifra: la cadena mas
  barata con todos los productos y cuanto mas sale en la SIGUIENTE, la misma
  cuenta que Mi compra (cifraDeLista). Sin lista invita a armarla con "Ver un
  ejemplo". Con lista propia, la primera vez de cada semana dice cuanto cambio
  desde la anterior.
*/
function TarjetaTuLista() {
  const { lista, esEjemplo } = useLista();
  const { zona, lista: zonaLista } = useZona();
  const cadenasZona = zona?.cadenas ?? [];
  // Hasta saber si hay zona guardada no se cotiza: la cifra del pais pasaria a la de la zona delante de los ojos.
  const clave = lista.length > 0 && zonaLista ? JSON.stringify([lista.map((i) => [i.id_producto, i.cantidad]), cadenasZona]) : "";
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

  const r = clave && estado?.clave === clave ? estado.resultado : null;
  const cifra = r ? cifraDeLista(vistaDeLista(r, zona ? cadenasVisibles(zona) : null).completas) : null;
  // La semana se compara solo con la lista propia: el ejemplo no es "tu lista".
  const actual =
    cifra && !esEjemplo
      ? { semana: lunesDe(hoyEnArgentina()), huella: huellaDeLista(lista, cadenasZona), cadena: cifra.barata.cadena, total: cifra.barata.total }
      : null;
  const cambio = actual ? cambioDeLaSemana(leerRegistroSemana(), actual) : null;
  const claveSemana = actual ? JSON.stringify(actual) : "";
  useEffect(() => {
    if (!claveSemana) return;
    const hoy = JSON.parse(claveSemana);
    guardarRegistroSemana(registrarSemana(leerRegistroSemana(), hoy));
  }, [claveSemana]);

  if (lista.length === 0) {
    return (
      <div className="mt-3 rounded-2xl bg-white/95 text-tinta px-4 py-3 shadow-flotante flex flex-wrap items-center justify-between gap-3">
        <span className="min-w-0 text-sm leading-snug">
          <span className="block font-bold">🛒 ¿Dónde te conviene tu compra?</span>
          Armá tu lista y te decimos en qué súper cerca sale menos.
        </span>
        <BotonVerEjemplo />
      </div>
    );
  }

  const n = lista.length;
  const siguiente = cifra?.siguiente;
  const diferencia = cifra && siguiente && cifra.diferencia >= 1 ? cifra.diferencia : 0;
  return (
    <Link
      to="/lista"
      className="mt-3 flex items-center justify-between gap-3 rounded-2xl bg-white/95 text-tinta px-4 py-3 shadow-flotante hover:bg-white transition-colors"
    >
      <span className="min-w-0 text-sm leading-snug">
        <span className="block text-xs font-bold uppercase tracking-wide text-marca">
          {esEjemplo ? "Mirá cuánto ahorrás en tu compra" : zona ? "Tu compra cerca tuyo" : "Tu compra"}
        </span>
        {cifra ? (
          <>
            <span className="block mt-0.5 text-[15px]">
              {esEjemplo ? "Una compra de ejemplo de " : "Tus "}
              {n} {n === 1 ? "producto" : "productos"} {esEjemplo ? "sale" : n === 1 ? "sale" : "salen"}{" "}
              <strong className="font-semibold numero">{formatearPesos(cifra.barata.total)}</strong> en{" "}
              <strong className="font-semibold">{cifra.barata.cadena}</strong>.
            </span>
            {diferencia > 0 && siguiente && (
              <span className="block text-tinta-media">
                En {siguiente.cadena}, la siguiente opción, pagás{" "}
                <strong className="font-semibold text-ahorro numero">{formatearPesos(diferencia)} más</strong>.
              </span>
            )}
            {cambio !== null && Math.abs(cambio) >= 1 && (
              <span className="block text-tinta-media">
                Esta semana, <strong className="font-semibold numero">{formatearPesos(Math.abs(cambio))}</strong>{" "}
                {cambio < 0 ? "menos" : "más"} que la semana pasada.
              </span>
            )}
          </>
        ) : (
          <span className="block mt-0.5">
            {n} {n === 1 ? "producto" : "productos"}: mirá dónde te conviene
          </span>
        )}
      </span>
      <span aria-hidden="true" className="shrink-0 text-marca font-bold">
        →
      </span>
    </Link>
  );
}

export default TarjetaTuLista;
