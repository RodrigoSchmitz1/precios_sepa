/*
  Las fotos del ticket se achican en el telefono antes de mandarlas (openspec
  mis-gastos-y-barra-nueva): una foto de celular pesa 3-5 MB y el texto de un
  ticket se lee igual con el lado largo en 1.600 px, en unos 200-400 KB.
*/
export const LADO_MAXIMO = 1600;
export const CALIDAD_JPEG = 0.8;

export function medidasAchicadas(ancho: number, alto: number, maximo = LADO_MAXIMO): { ancho: number; alto: number } {
  const lado = Math.max(ancho, alto);
  if (lado <= maximo) return { ancho, alto };
  const factor = maximo / lado;
  return { ancho: Math.round(ancho * factor), alto: Math.round(alto * factor) };
}

async function decodificar(archivo: Blob): Promise<CanvasImageSource & { width: number; height: number }> {
  if (typeof createImageBitmap === "function") {
    try {
      return await createImageBitmap(archivo);
    } catch {
      /* Safari viejo o formato raro: se prueba con un <img> */
    }
  }
  const url = URL.createObjectURL(archivo);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return Object.assign(img, { width: img.naturalWidth, height: img.naturalHeight });
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** La foto achicada, como JPEG en base64 sin el prefijo "data:". */
export async function achicarFoto(archivo: Blob): Promise<string> {
  const imagen = await decodificar(archivo);
  const { ancho, alto } = medidasAchicadas(imagen.width, imagen.height);
  const lienzo = document.createElement("canvas");
  lienzo.width = ancho;
  lienzo.height = alto;
  const contexto = lienzo.getContext("2d");
  if (!contexto) throw new Error("No se pudo preparar la foto.");
  contexto.drawImage(imagen, 0, 0, ancho, alto);
  const datos = lienzo.toDataURL("image/jpeg", CALIDAD_JPEG);
  return datos.slice(datos.indexOf(",") + 1);
}
