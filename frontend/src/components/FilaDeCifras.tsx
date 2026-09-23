import type { ReactNode } from "react";

/*
  Cifras de apoyo debajo del titular o de un grafico.

  Reemplaza a la fila de tiles de cuatro colores. Cuatro recuadros de fondo
  distinto competian entre si y con el titular por la atencion, y el color no
  codificaba nada: era una cifra distinta en cada caja. Aca van en tinta, en
  columnas separadas por una linea fina, y el unico color de la pagina queda
  para el dato que lo merece.

  2026-09-23: las cifras se agrandan de 18px a 30px. En la version anterior
  quedaban del mismo cuerpo que el texto corrido de al lado, asi que la fila se
  leia como un parrafo en columnas y no como cifras. Que no tengan color no
  quiere decir que no tengan que pesar: el peso lo da el cuerpo. La etiqueta se
  achica y se pone en versalitas para que el numero domine su columna.
*/

export type Cifra = {
  etiqueta: string;
  valor: ReactNode;
  detalle?: ReactNode;
};

function FilaDeCifras({ cifras }: { cifras: Cifra[] }) {
  return (
    <dl className="grid grid-cols-2 gap-x-4 sm:gap-x-0 sm:grid-flow-col sm:auto-cols-fr border-y border-linea">
      {cifras.map((c) => (
        <div
          key={c.etiqueta}
          className="py-5 sm:px-6 sm:first:pl-0 sm:border-l sm:first:border-l-0 border-linea min-w-0"
        >
          <dt className="text-[11px] font-semibold uppercase tracking-wider text-tinta-suave mb-1">
            {c.etiqueta}
          </dt>
          <dd className="numero text-2xl sm:text-3xl font-medium text-tinta leading-none truncate">{c.valor}</dd>
          {c.detalle && <dd className="mt-1.5 text-xs text-tinta-media leading-snug">{c.detalle}</dd>}
        </div>
      ))}
    </dl>
  );
}

export default FilaDeCifras;
