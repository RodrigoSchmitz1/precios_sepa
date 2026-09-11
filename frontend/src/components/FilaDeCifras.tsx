import type { ReactNode } from "react";

/*
  Cifras de apoyo debajo del titular o de un grafico.

  Reemplaza a la fila de tiles de cuatro colores. Cuatro recuadros de fondo
  distinto compiten entre si y con el titular por la atencion, y el color no
  codificaba nada: era una cifra distinta en cada caja. Aca van en tinta, en
  columnas separadas por una linea fina, y el unico color de la pagina queda
  para el dato que lo merece.
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
          className="py-3 sm:px-5 sm:first:pl-0 sm:border-l sm:first:border-l-0 border-linea min-w-0"
        >
          <dt className="text-xs text-tinta-suave">{c.etiqueta}</dt>
          <dd className="numero text-lg font-medium text-tinta truncate">{c.valor}</dd>
          {c.detalle && <dd className="text-xs text-tinta-media leading-snug">{c.detalle}</dd>}
        </div>
      ))}
    </dl>
  );
}

export default FilaDeCifras;
