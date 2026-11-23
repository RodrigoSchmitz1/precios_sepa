import { useState, type FormEvent } from "react";
import { interpretarCanasta } from "../api/client";
import { useLista } from "../contexto/lista";
import type { ItemCanastaIA, ProductoSugerido } from "../types";
import { borrarDelNavegador, leerDelNavegador } from "../utils/canastaGuardada";
import { nombreParaLista } from "../utils/nombreParaLista";
import DeTuCanasta from "./DeTuCanasta";
import EmpezarConCanastaBasica from "./EmpezarConCanastaBasica";

/*
  Armar Mi compra por categorias (openspec mi-compra). Lo util de Tu canasta,
  dentro de la lista: contar quienes viven en la casa (la misma IA) o partir de
  la canasta basica del INDEC, y despues elegir la marca de cada categoria con
  un toque (DeTuCanasta). La lista sigue siendo de productos exactos.

  Si el navegador tenia una canasta guardada de Tu canasta, se ofrece pasarla
  a la lista por el mismo camino; al terminar o descartarla, se borra.
*/

type Origen = "hogar" | "basica" | "guardada";

export default function ArmarCompra({ onVer }: { onVer: (id: string) => void }) {
  const { lista, agregar } = useLista();
  const [guardada, setGuardada] = useState(() => leerDelNavegador()?.items ?? []);
  const [elegir, setElegir] = useState<{ origen: Origen; items: ItemCanastaIA[] } | null>(null);
  const [modo, setModo] = useState<"cerrado" | "hogar" | "basica">("cerrado");
  const [descripcion, setDescripcion] = useState("");
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const terminar = () => {
    if (elegir?.origen === "guardada") {
      borrarDelNavegador();
      setGuardada([]);
    }
    setElegir(null);
    setModo("cerrado");
  };

  const interpretar = async (e: FormEvent) => {
    e.preventDefault();
    if (descripcion.trim().length < 3) return;
    setCargando(true);
    setError(null);
    try {
      const { items } = await interpretarCanasta(descripcion.trim());
      setElegir({ origen: "hogar", items });
    } catch (err) {
      setError(err instanceof Error ? err.message : "No pudimos armar la compra.");
    } finally {
      setCargando(false);
    }
  };

  const agregarSugerido = (p: ProductoSugerido, cantidad: number) =>
    agregar({ id_producto: p.id_producto, nombre: nombreParaLista(p), cantidad, categoria: p.categoria });

  if (elegir) {
    return (
      <section className="mb-10">
        <DeTuCanasta items={elegir.items} lista={lista} onAgregar={agregarSugerido} onVer={onVer} nombrar={nombreParaLista} />
        <button type="button" onClick={terminar} className="-mt-4 fondo-marca text-white font-bold rounded-2xl min-h-12 px-5">
          Listo
        </button>
      </section>
    );
  }

  return (
    <>
      {guardada.length > 0 && (
        <section className="tarjeta p-5 sm:p-6 mb-6">
          <h2 className="text-lg font-bold text-tinta mb-1">Tenés una canasta guardada</h2>
          <p className="text-sm text-tinta-media mb-4">
            Elegí las marcas de sus {guardada.length} categorías para pasarla a tu lista.
          </p>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => setElegir({ origen: "guardada", items: guardada })} className="fondo-marca text-white font-bold rounded-2xl min-h-12 px-5">
              Elegir las marcas
            </button>
            <button
              type="button"
              onClick={() => {
                borrarDelNavegador();
                setGuardada([]);
              }}
              className="text-tinta-media font-semibold min-h-12 px-3"
            >
              Descartar
            </button>
          </div>
        </section>
      )}

      <section className="tarjeta p-5 sm:p-6 mb-6">
        <h2 className="text-lg font-bold text-tinta mb-1">¿Es la compra del mes?</h2>
        <p className="text-sm text-tinta-media mb-4">Armala por categorías y elegí la marca de cada cosa con un toque.</p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            aria-expanded={modo === "hogar"}
            onClick={() => setModo(modo === "hogar" ? "cerrado" : "hogar")}
            className={`rounded-2xl min-h-12 px-4 font-bold ${modo === "hogar" ? "fondo-marca text-white" : "bg-marca-tenue text-marca"}`}
          >
            Contanos quiénes viven en tu casa
          </button>
          <button
            type="button"
            aria-expanded={modo === "basica"}
            onClick={() => setModo(modo === "basica" ? "cerrado" : "basica")}
            className={`rounded-2xl min-h-12 px-4 font-bold ${modo === "basica" ? "fondo-marca text-white" : "bg-marca-tenue text-marca"}`}
          >
            Empezar con la canasta básica
          </button>
        </div>

        {modo === "hogar" && (
          <form onSubmit={interpretar} className="mt-4 grid gap-3">
            <label className="grid gap-1 text-sm text-tinta-media">
              Quiénes viven y qué consumen
              <textarea
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
                rows={3}
                maxLength={500}
                placeholder="Somos 2 adultos y 2 chicos, tomamos mate y no comemos carne roja"
                className="rounded-2xl border border-linea-fuerte bg-papel p-3 text-base text-tinta"
              />
            </label>
            <button type="submit" disabled={cargando || descripcion.trim().length < 3} className="fondo-marca text-white font-bold rounded-2xl min-h-12 px-5 justify-self-start disabled:opacity-50">
              {cargando ? "Armando…" : "Armar mi compra"}
            </button>
            {error && (
              <p role="alert" className="rounded-2xl bg-alerta-tenue text-tinta text-sm p-3">
                {error}{" "}
                <button type="button" className="text-marca font-bold underline" onClick={() => setModo("basica")}>
                  Empezar con la canasta básica
                </button>
              </p>
            )}
          </form>
        )}

        {modo === "basica" && (
          <div className="mt-4">
            <EmpezarConCanastaBasica onCargar={(items) => setElegir({ origen: "basica", items })} />
          </div>
        )}
      </section>
    </>
  );
}
