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

export async function compartir(datos: DatosParaCompartir, nav: Navegador = navigator): Promise<ResultadoCompartir> {
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
    await nav.clipboard.writeText(datos.url);
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
