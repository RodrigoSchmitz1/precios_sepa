import type { IncidenciaCanasta } from "../types";
import { fechaEnPalabras, formatearVariacion } from "./formato";
import { nombreCategoria } from "./nombres";

/*
  Lo que dice la cascada de la canasta, separado del dibujo para poder probarlo.

  Auditoria 2026-10-28:
  - Con cobertura parcial el titular decia "La canasta basica subio X%" y la
    aclaracion iba en letra chica. En octubre la X era el 58% del gasto: ahora el
    titular dice que son las categorias medidas.
  - "En lo que va del mes" se decia aunque el periodo arrancara a mitad de mes.
  - Las categorias sin precio no se pueden pesar y van aparte de las sin indice.
*/
export function textosCascada(datos: IncidenciaCanasta, esElUltimo: boolean) {
  const total = datos.variacion_canasta_pct ?? 0;
  const sinPrecio = datos.sin_precio ?? [];
  const parcial = datos.cobertura_pct < 99.5 || sinPrecio.length > 0;
  const n = datos.categorias.length;
  const cuanto = formatearVariacion(Math.abs(total)).replace("+", "");

  const titulo = parcial
    ? n === 1
      ? `La única categoría medida de la canasta básica ${total >= 0 ? "subió" : "bajó"} ${cuanto}`
      : `Las ${n} categorías medidas de la canasta básica ${total >= 0 ? "subieron" : "bajaron"} ${cuanto}`
    : `La canasta básica ${total >= 0 ? "subió" : "bajó"} ${cuanto}`;

  const periodo = !datos.desde_inicio_de_mes
    ? ` desde el ${fechaEnPalabras(datos.fecha_inicio)}`
    : esElUltimo
      ? " en lo que va del mes"
      : "";

  const avisos: string[] = [];
  if (parcial) {
    const cobertura = datos.cobertura_pct.toLocaleString("es-AR");
    avisos.push(
      sinPrecio.length > 0
        ? `Son el ${cobertura}% del gasto de las categorías con precio.`
        : `Son el ${cobertura}% del gasto de la canasta.`
    );
    if (datos.sin_indice.length > 0)
      avisos.push(`Sin índice este mes: ${datos.sin_indice.map(nombreCategoria).join(", ")}.`);
    if (sinPrecio.length > 0) avisos.push(`Sin precio para pesarlas: ${sinPrecio.map(nombreCategoria).join(", ")}.`);
  }

  return {
    titulo,
    periodo,
    aviso: avisos.length > 0 ? avisos.join(" ") : null,
    etiquetaTotal: parcial ? "Lo medido" : "Canasta básica",
  };
}
