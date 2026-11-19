import { useEffect, useState } from "react";
import { obtenerBasicos } from "../api/client";
import { useLista } from "../contexto/lista";
import type { Basico } from "../types";
import { nombreParaLista } from "../utils/nombreParaLista";

/*
  Armar la lista con productos basicos (openspec lista-en-el-centro). Unos 40
  productos comunes, agrupados; cada uno se suma o se saca con un toque. Salen
  de una lista fija de busquedas que la API resuelve con el buscador del sitio
  (ver BASICOS en api/mismo_producto.py).
*/

function nombreDelProducto(b: Basico): string {
  return nombreParaLista(b.producto);
}

function ArmadoRapido() {
  const { agregar, quitar, enLista } = useLista();
  const [basicos, setBasicos] = useState<Basico[] | null>(null);

  useEffect(() => {
    let cancelado = false;
    obtenerBasicos()
      .then((b) => !cancelado && setBasicos(b))
      .catch(() => !cancelado && setBasicos([]));
    return () => {
      cancelado = true;
    };
  }, []);

  if (basicos === null) return <p className="text-sm text-tinta-suave">Cargando los básicos…</p>;
  if (basicos.length === 0) return null;

  const grupos = [...new Set(basicos.map((b) => b.grupo))];
  const tocar = (b: Basico) => {
    const id = b.producto.id_producto;
    if (enLista(id)) quitar(id);
    else agregar({ id_producto: id, nombre: nombreDelProducto(b), cantidad: 1, categoria: b.producto.categoria });
  };

  return (
    <div className="space-y-4">
      {grupos.map((grupo) => (
        <div key={grupo}>
          <h3 className="text-sm font-bold text-tinta mb-2">{grupo}</h3>
          <ul className="flex flex-wrap gap-2">
            {basicos
              .filter((b) => b.grupo === grupo)
              .map((b) => {
                const puesto = enLista(b.producto.id_producto);
                return (
                  <li key={b.producto.id_producto}>
                    <button
                      type="button"
                      onClick={() => tocar(b)}
                      aria-pressed={puesto}
                      title={nombreDelProducto(b)}
                      className={[
                        "rounded-full border px-3.5 py-2 text-sm font-medium transition-colors",
                        puesto ? "bg-marca text-white border-marca" : "bg-papel text-tinta border-linea hover:border-marca-borde",
                      ].join(" ")}
                    >
                      {puesto ? "✓ " : "+ "}
                      {b.nombre}
                    </button>
                  </li>
                );
              })}
          </ul>
        </div>
      ))}
      <p className="text-xs text-tinta-suave">
        Cada básico es el producto que más aparece al buscarlo. Para elegir otra marca, buscala arriba.
      </p>
    </div>
  );
}

export default ArmadoRapido;
