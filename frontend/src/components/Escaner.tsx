import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link } from "react-router";
import wasmUrl from "zxing-wasm/reader/zxing_reader.wasm?url";
import { obtenerProducto } from "../api/client";
import { useLista } from "../contexto/lista";
import type { ProductoDetalle } from "../types";
import { codigoValido, FORMATOS_DE_CODIGO, resolverCodigo } from "../utils/codigoDeBarras";
import { formatearPesos } from "../utils/formato";
import { nombreParaLista } from "../utils/nombreParaLista";

/*
  El escaner de codigos de barras (openspec app-para-el-usuario, idea de Convi).
  Este archivo entero se descarga recien al tocar "Escanear" (BotonEscanear).

  Chrome en Android trae BarcodeDetector; Safari en iPhone no, y ahi se usa el
  paquete barcode-detector (zxing-wasm), importado en ese momento. El .wasm se
  sirve desde el propio sitio: por defecto zxing-wasm lo baja de un CDN, y no
  queremos que la camara del usuario dependa de un tercero.
*/

type Detector = { detect: (fuente: HTMLVideoElement) => Promise<{ rawValue: string }[]> };
type ConstructorDetector = {
  new (opciones: { formats: string[] }): Detector;
  getSupportedFormats?: () => Promise<string[]>;
};

async function crearDetector(): Promise<Detector> {
  const nativo = (window as unknown as { BarcodeDetector?: ConstructorDetector }).BarcodeDetector;
  if (nativo?.getSupportedFormats) {
    const soportados = await nativo.getSupportedFormats();
    if (soportados.includes("ean_13")) return new nativo({ formats: FORMATOS_DE_CODIGO.filter((f) => soportados.includes(f)) });
  }
  const { BarcodeDetector, prepareZXingModule } = await import("barcode-detector/ponyfill");
  prepareZXingModule({
    overrides: { locateFile: (ruta: string, prefijo: string) => (ruta.endsWith(".wasm") ? wasmUrl : prefijo + ruta) },
  });
  return new BarcodeDetector({ formats: [...FORMATOS_DE_CODIGO] });
}

type Estado =
  | { paso: "camara" }
  | { paso: "sin-camara" }
  | { paso: "buscando"; codigo: string }
  | { paso: "encontrado"; producto: ProductoDetalle }
  | { paso: "no-esta"; codigo: string };

export default function Escaner({ onCerrar }: { onCerrar: () => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const [estado, setEstado] = useState<Estado>({ paso: "camara" });
  const [escrito, setEscrito] = useState("");
  const { agregar, enLista } = useLista();

  const buscar = async (codigo: string) => {
    setEstado({ paso: "buscando", codigo });
    const producto = await resolverCodigo(codigo, obtenerProducto);
    setEstado(producto ? { paso: "encontrado", producto } : { paso: "no-esta", codigo });
  };

  // La camara se prende mientras se esta en el paso "camara" y se apaga al salir de el.
  const enCamara = estado.paso === "camara";
  useEffect(() => {
    if (!enCamara) return;
    let vigente = true;
    let flujo: MediaStream | null = null;
    let intervalo: ReturnType<typeof setInterval> | undefined;
    (async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error("sin camara");
        flujo = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
        if (!vigente || !video.current) return;
        video.current.srcObject = flujo;
        await video.current.play();
        const detector = await crearDetector();
        intervalo = setInterval(async () => {
          if (!vigente || !video.current || video.current.readyState < 2) return;
          try {
            const [leido] = await detector.detect(video.current);
            const codigo = leido && codigoValido(leido.rawValue);
            if (codigo && vigente) {
              vigente = false;
              clearInterval(intervalo);
              void buscar(codigo);
            }
          } catch {
            /* un cuadro que no se pudo leer: se prueba con el siguiente */
          }
        }, 350);
      } catch {
        if (vigente) setEstado({ paso: "sin-camara" });
      }
    })();
    return () => {
      vigente = false;
      clearInterval(intervalo);
      flujo?.getTracks().forEach((pista) => pista.stop());
    };
    // buscar solo cambia el estado; no tiene que reiniciar la camara.
  }, [enCamara]);

  useEffect(() => {
    const alTeclear = (e: KeyboardEvent) => e.key === "Escape" && onCerrar();
    window.addEventListener("keydown", alTeclear);
    return () => window.removeEventListener("keydown", alTeclear);
  }, [onCerrar]);

  const enviar = (e: FormEvent) => {
    e.preventDefault();
    const codigo = codigoValido(escrito);
    if (codigo) void buscar(codigo);
  };

  return (
    <div className="fixed inset-0 z-[1500] bg-tinta/60 flex items-end sm:items-center justify-center" role="dialog" aria-modal="true" aria-label="Escanear un producto">
      <div className="w-full sm:max-w-md bg-papel rounded-t-3xl sm:rounded-3xl p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold text-tinta">Escanear un producto</h2>
          <button type="button" onClick={onCerrar} aria-label="Cerrar" className="w-11 h-11 grid place-items-center text-xl text-tinta-media">
            ×
          </button>
        </div>

        {estado.paso === "camara" && (
          <>
            <div className="relative rounded-2xl overflow-hidden bg-tinta aspect-[4/3]">
              <video ref={video} muted playsInline className="w-full h-full object-cover" />
              <span aria-hidden="true" className="absolute inset-x-8 top-1/2 h-0.5 bg-ahorro/80" />
            </div>
            <p className="text-sm text-tinta-media mt-2">Apuntá al código de barras del paquete.</p>
          </>
        )}
        {estado.paso === "sin-camara" && (
          <p role="alert" className="text-sm text-tinta">
            No pudimos usar la cámara. Podés escribir el código que está debajo de las barras.
          </p>
        )}
        {estado.paso === "buscando" && (
          <p role="status" className="text-sm text-tinta-media">
            Buscando el código {estado.codigo}…
          </p>
        )}
        {estado.paso === "no-esta" && (
          <div role="alert" className="text-sm text-tinta">
            <p>El código {estado.codigo} no figura en los precios de SEPA.</p>
            <Link to="/mismo-producto" onClick={onCerrar} className="inline-block mt-2 font-bold text-marca underline underline-offset-2">
              Buscarlo por nombre
            </Link>
          </div>
        )}
        {estado.paso === "encontrado" && (
          <div className="rounded-2xl border border-linea p-3">
            <p className="font-bold text-tinta">{nombreParaLista(estado.producto)}</p>
            <p className="text-sm text-tinta-media mt-0.5">
              En {estado.producto.cadenas} cadenas, desde <span className="numero font-semibold text-tinta">{formatearPesos(estado.producto.precio_mas_bajo)}</span>
            </p>
            <div className="flex flex-wrap gap-2 mt-3">
              {enLista(estado.producto.id_producto) ? (
                <span className="rounded-xl bg-ahorro-tenue text-ahorro text-sm font-bold px-4 py-2.5">✓ En la lista</span>
              ) : (
                <button
                  type="button"
                  onClick={() =>
                    agregar({
                      id_producto: estado.producto.id_producto,
                      nombre: nombreParaLista(estado.producto),
                      cantidad: 1,
                      categoria: estado.producto.categoria,
                    })
                  }
                  className="rounded-xl fondo-marca text-white text-sm font-bold px-4 py-2.5 min-h-11"
                >
                  + Lista
                </button>
              )}
              <Link
                to={`/mismo-producto?p=${encodeURIComponent(estado.producto.id_producto)}`}
                onClick={onCerrar}
                className="rounded-xl border border-linea-fuerte text-sm font-bold text-tinta px-4 py-2.5 min-h-11 inline-flex items-center"
              >
                Ver precios
              </Link>
            </div>
          </div>
        )}

        {estado.paso !== "camara" && estado.paso !== "buscando" && (
          <button type="button" onClick={() => setEstado({ paso: "camara" })} className="mt-3 text-sm font-bold text-marca underline underline-offset-2">
            Escanear otro
          </button>
        )}

        <form onSubmit={enviar} className="mt-4 flex gap-2">
          <input
            type="text"
            inputMode="numeric"
            value={escrito}
            onChange={(e) => setEscrito(e.target.value)}
            placeholder="O escribí el código"
            aria-label="Código de barras"
            className="flex-1 min-w-0 rounded-xl border border-linea px-3 py-2.5 text-base"
          />
          <button type="submit" className="shrink-0 rounded-xl bg-tinta text-white text-sm font-bold px-4">
            Buscar
          </button>
        </form>
      </div>
    </div>
  );
}
