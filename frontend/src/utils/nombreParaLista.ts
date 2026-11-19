import { tamanoQueFalta } from "./formato";
import { nombreLegible } from "./texto";

/** El nombre con que un producto queda en Tu lista: legible y con el tamaño si
 *  la descripción no lo dice. Lo usan el armado rápido, la lista recibida por
 *  link y el pegado (openspec compartir-y-pegar-la-lista). */
export function nombreParaLista(p: {
  descripcion: string;
  marca: string | null;
  cantidad_normalizada?: number | null;
  unidad_normalizada?: "g" | "cc" | "unidad" | null;
}): string {
  const tamano = tamanoQueFalta(p.descripcion, p.cantidad_normalizada, p.unidad_normalizada);
  return nombreLegible(p.descripcion, p.marca) + (tamano ? ` (${tamano})` : "");
}
