import { lazy, Suspense, useState } from "react";

// El escaner (camara, lector y su .wasm) se descarga recien al tocar el boton.
const Escaner = lazy(() => import("./Escaner"));

/* "Escanear" (openspec app-para-el-usuario): sumar un producto con la camara. */
export default function BotonEscanear({ className = "" }: { className?: string }) {
  const [abierto, setAbierto] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className={`inline-flex items-center gap-2 rounded-xl border border-linea-fuerte bg-papel px-4 py-2.5 min-h-11 text-sm font-bold text-tinta hover:border-marca ${className}`}
      >
        <span aria-hidden="true">📷</span> Escanear
      </button>
      {abierto && (
        <Suspense
          fallback={
            <div role="status" className="fixed inset-0 z-[1500] bg-tinta/60 grid place-items-center text-white text-sm">
              Abriendo la cámara…
            </div>
          }
        >
          <Escaner onCerrar={() => setAbierto(false)} />
        </Suspense>
      )}
    </>
  );
}
