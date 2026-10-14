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

  2026-10-14, estilo "App": cada cifra va en su tarjeta blanca con sombra y el
  numero en la letra de los titulos (pesada). Las columnas separadas por rayitas
  eran parte del aire "de diario".
*/

export type Cifra = {
  etiqueta: string;
  valor: ReactNode;
  detalle?: ReactNode;
};

function FilaDeCifras({ cifras }: { cifras: Cifra[] }) {
  return (
    <dl className="grid grid-cols-2 sm:grid-cols-none sm:grid-flow-col sm:auto-cols-fr gap-3 sm:gap-4">
      {cifras.map((c) => (
        <div key={c.etiqueta} className="tarjeta p-4 sm:p-5 min-w-0">
          <dt className="text-xs sm:text-sm font-semibold text-tinta-suave mb-1.5">{c.etiqueta}</dt>
          <dd className="font-display text-xl sm:text-[2rem] text-tinta leading-tight break-words">{c.valor}</dd>
          {c.detalle && <dd className="mt-1.5 text-xs sm:text-sm text-tinta-media leading-snug">{c.detalle}</dd>}
        </div>
      ))}
    </dl>
  );
}

export default FilaDeCifras;
