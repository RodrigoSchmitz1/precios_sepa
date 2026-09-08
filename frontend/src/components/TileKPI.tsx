import type { ReactNode } from "react";

/*
  Tile de KPI: etiqueta, valor destacado y un detalle opcional.

  El valor NO lleva la clase .numero a proposito. Las cifras de ancho fijo son
  para columnas que se alinean verticalmente; a tamano display le dan a cada
  digito el ancho de un cero y el numero queda suelto.

  Los cuatro tonos son la paleta de datos validada. Se usan en filas (marcas
  adyacentes), que es el escenario en el que esa paleta pasa los checks, y cada
  tile lleva su etiqueta, asi que la identificacion nunca depende del color.
*/
export type TonoTile = "verde" | "ocre" | "azul" | "ciruela" | "neutro";

const TONOS: Record<TonoTile, { fondo: string; borde: string; texto: string }> = {
  verde: { fondo: "bg-dato-verde-tenue", borde: "border-dato-verde/25", texto: "text-dato-verde" },
  ocre: { fondo: "bg-dato-ocre-tenue", borde: "border-dato-ocre/25", texto: "text-dato-ocre" },
  azul: { fondo: "bg-dato-azul-tenue", borde: "border-dato-azul/25", texto: "text-dato-azul" },
  ciruela: {
    fondo: "bg-dato-ciruela-tenue",
    borde: "border-dato-ciruela/25",
    texto: "text-dato-ciruela",
  },
  neutro: { fondo: "bg-papel", borde: "border-linea", texto: "text-tinta" },
};

type Props = {
  etiqueta: string;
  valor: ReactNode;
  detalle?: ReactNode;
  tono?: TonoTile;
};

function TileKPI({ etiqueta, valor, detalle, tono = "neutro" }: Props) {
  const estilo = TONOS[tono];

  return (
    <div className={`rounded-xl border p-4 ${estilo.fondo} ${estilo.borde}`}>
      <p className="text-xs font-medium uppercase tracking-wider text-tinta-suave mb-1.5">
        {etiqueta}
      </p>
      <p className={`text-2xl font-semibold leading-tight ${estilo.texto}`}>{valor}</p>
      {detalle && <p className="text-xs text-tinta-media mt-1 leading-snug">{detalle}</p>}
    </div>
  );
}

export default TileKPI;
