import { useEffect, useMemo, useState } from "react";
import { obtenerInflacionResumen } from "../../api/client";
import type { Gasto } from "../../types";
import { formatearVariacion, mesEnPalabras } from "../../utils/formato";
import { gondolaPonderada, MINIMO_PRODUCTOS_INFLACION, tuInflacion } from "../../utils/tuInflacion";
import { hoyEnArgentina } from "../../utils/gastos";
import { mesDe } from "../../utils/resumenGastos";

/*
  "Tu inflacion" en Mis gastos (openspec app-para-el-usuario). Se calcula en el
  telefono; la gondola de las mismas categorias se pide recien cuando hay con
  que comparar (/inflacion/resumen, guardado 6 horas en la API: no es una
  consulta por usuario).
*/
export default function TarjetaTuInflacion({ gastos, mes }: { gastos: Gasto[]; mes: string }) {
  const resultado = useMemo(() => tuInflacion(gastos, mes), [gastos, mes]);
  const [gondola, setGondola] = useState<{ mes: string; valor: number | null } | null>(null);
  const pesos = resultado.estado === "ok" ? resultado.pesos : null;

  useEffect(() => {
    if (!pesos) return;
    let cancelado = false;
    // El mes en curso se pide sin parametro: es el mismo pedido (y la misma cache) que la pagina de Inflacion.
    obtenerInflacionResumen(mes === mesDe(hoyEnArgentina()) ? undefined : mes)
      .then((resumen) => !cancelado && setGondola({ mes, valor: gondolaPonderada(pesos, resumen) }))
      .catch(() => !cancelado && setGondola({ mes, valor: null }));
    return () => {
      cancelado = true;
    };
  }, [pesos, mes]);

  const delSuper = gondola?.mes === mes ? gondola.valor : null;
  return (
    <section className="tarjeta p-5 sm:p-6 mb-4" aria-labelledby="titulo-tu-inflacion">
      <h2 id="titulo-tu-inflacion" className="text-base font-bold text-tinta mb-3 flex items-baseline justify-between gap-2">
        Tu inflación
        <span className="text-xs font-semibold text-tinta-suave">tus mismos productos</span>
      </h2>
      {resultado.estado === "sin-datos" ? (
        <p className="text-sm text-tinta-media">
          {resultado.comunes === 0
            ? "Con tickets de dos meses vas a ver cuánto te subió a vos lo que comprás, producto por producto."
            : `Todavía no alcanza: hay ${resultado.comunes} ${resultado.comunes === 1 ? "producto repetido" : "productos repetidos"} entre los dos meses y hacen falta ${MINIMO_PRODUCTOS_INFLACION}.`}
        </p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl bg-papel-hundido p-3">
              <p className="text-2xl font-extrabold text-tinta numero">{formatearVariacion(resultado.variacion * 100, 1)}</p>
              <p className="text-xs text-tinta-media">lo que pagás vos, contra {mesEnPalabras(mesAnterior(mes))}</p>
            </div>
            <div className="rounded-2xl bg-papel-hundido p-3">
              <p className="text-2xl font-extrabold text-tinta-media numero">{delSuper === null ? "—" : formatearVariacion(delSuper * 100, 1)}</p>
              <p className="text-xs text-tinta-media">la góndola en esas categorías</p>
            </div>
          </div>
          <p className="text-sm text-tinta-media mt-3">
            Sobre {resultado.comunes} productos que compraste los dos meses. Lo que más te subió:{" "}
            <strong className="text-tinta">{resultado.masSubio.nombre}</strong> ({formatearVariacion(resultado.masSubio.variacion * 100, 0)}).
            {resultado.masBajo.variacion < 0 && (
              <>
                {" "}Lo que más te bajó: <strong className="text-tinta">{resultado.masBajo.nombre}</strong> (
                {formatearVariacion(resultado.masBajo.variacion * 100, 0)}).
              </>
            )}
          </p>
        </>
      )}
    </section>
  );
}

function mesAnterior(mes: string): string {
  const [a, m] = mes.split("-").map(Number);
  return m === 1 ? `${a - 1}-12-01` : `${a}-${String(m - 1).padStart(2, "0")}-01`;
}
