/*
  Compartir un link (openspec compartir-por-whatsapp).

  En el celular abre el menu nativo (WhatsApp, Telegram, lo que tenga la
  persona). Donde no existe, como en la mayoria de las computadoras, copia el
  link. Si tampoco se puede copiar, avisa para que se copie a mano.
*/

export type DatosParaCompartir = { titulo: string; texto: string; url: string };

/** "cancelado" es el usuario cerrando el menu: no es un error y no se avisa. */
export type ResultadoCompartir = "compartido" | "cancelado" | "copiado" | "fallo";

type Navegador = Pick<Navigator, "share" | "clipboard">;

/**
 * copiarTexto: donde no hay menu nativo se copian el texto y el link juntos, y
 * no solo el link. En una lista el texto es el contenido (los productos y donde
 * sale menos); el link es para rearmarla (openspec compartir-y-pegar-la-lista).
 */
export async function compartir(
  datos: DatosParaCompartir,
  nav: Navegador = navigator,
  { copiarTexto = false }: { copiarTexto?: boolean } = {},
): Promise<ResultadoCompartir> {
  if (typeof nav.share === "function") {
    try {
      await nav.share({ title: datos.titulo, text: datos.texto, url: datos.url });
      return "compartido";
    } catch (error) {
      // Por el nombre y no con instanceof Error: segun el entorno, DOMException
      // no hereda de Error (paso en jsdom).
      if ((error as { name?: string } | null)?.name === "AbortError") return "cancelado";
      // Otro error (p. ej. NotAllowedError sin gesto directo): se intenta copiar.
    }
  }
  try {
    await nav.clipboard.writeText(copiarTexto ? `${datos.texto}\n${datos.url}` : datos.url);
    return "copiado";
  } catch {
    return "fallo";
  }
}

/** El texto de un titular tal como se ve, en una linea. */
export function textoEnUnaLinea(texto: string | null | undefined): string {
  return (texto ?? "").replace(/\s+/g, " ").trim();
}

/**
 * El texto que acompaña el link: el producto y el titular de la pagina. Quien
 * lo recibe no esta en "tu zona": "En tu zona" pasa a ser la zona de quien
 * comparte ("En Palermo, CABA cuesta casi lo mismo...").
 */
export function textoParaCompartir(nombre: string, titular: string, zona: string | null): string {
  const linea = textoEnUnaLinea(titular);
  if (!linea) return nombre;
  const conZona = zona ? linea.replace(/\b[Ee]n tu zona\b/g, `en ${zona}`).replace(/^en /, "En ") : linea;
  return `${nombre}: ${conZona}`;
}

/**
 * El texto de Tu lista para WhatsApp (openspec compartir-y-pegar-la-lista). Se
 * entiende sin abrir el link: los productos con sus cantidades y donde sale
 * menos la lista completa, en la zona de quien comparte. Sin una cadena con
 * todo, la linea del precio no va.
 */
export function textoDeLista(
  items: { nombre: string; cantidad: number }[],
  barata: { cadena: string; total: number } | null,
  zona: string | null,
  formatearPesos: (valor: number) => string,
): string {
  const lineas = [`Mi lista del súper · ${items.length} ${items.length === 1 ? "producto" : "productos"}`];
  if (barata) lineas.push(`${zona ? `En ${zona}, en` : "En"} ${barata.cadena} sale ${formatearPesos(barata.total)}`);
  for (const i of items) lineas.push(`• ${i.cantidad} × ${i.nombre}`);
  lineas.push("Armala y comparala en tu zona:");
  return lineas.join("\n");
}
