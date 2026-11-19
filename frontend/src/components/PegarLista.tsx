import { useState, type FormEvent } from "react";
import { interpretarLista } from "../api/client";
import { useLista } from "../contexto/lista";
import type { RenglonInterpretado } from "../types";
import { MAXIMO_PRODUCTOS, MAXIMO_UNIDADES } from "../utils/lista";
import { nombreParaLista } from "../utils/nombreParaLista";

/*
  Pegar una lista escrita (openspec compartir-y-pegar-la-lista): la de un chat,
  "2 leches, yerba, pan". La API convierte cada renglon con el buscador del
  sitio, sin IA (lo decidio Rodrigo), y aca la persona ve lo elegido para cada
  uno, lo cambia o lo saca, y suma todo de un toque. Nada se suma a ciegas.
*/
type Fila = RenglonInterpretado & { elegido: number; cantidadElegida: number; quitado: boolean };

function PegarLista() {
  const { lista, sumar } = useLista();
  const [texto, setTexto] = useState("");
  const [filas, setFilas] = useState<Fila[] | null>(null);
  const [estado, setEstado] = useState<"" | "buscando" | "error" | "sumado">("");
  const [sumados, setSumados] = useState(0);

  async function buscar(e: FormEvent) {
    e.preventDefault();
    if (!texto.trim()) return;
    setEstado("buscando");
    try {
      const renglones = await interpretarLista(texto);
      setFilas(renglones.map((r) => ({ ...r, elegido: 0, cantidadElegida: r.cantidad, quitado: false })));
      setEstado("");
    } catch {
      setEstado("error");
    }
  }

  const cambiar = (i: number, cambios: Partial<Fila>) =>
    setFilas((previas) => previas && previas.map((f, j) => (j === i ? { ...f, ...cambios } : f)));

  const paraSumar = (filas ?? []).filter((f) => !f.quitado && f.candidatos.length > 0);
  const lugar = MAXIMO_PRODUCTOS - lista.length;

  function sumarTodo() {
    const items = paraSumar.map((f) => {
      const p = f.candidatos[f.elegido];
      return { id_producto: p.id_producto, nombre: nombreParaLista(p), cantidad: f.cantidadElegida, categoria: p.categoria };
    });
    sumar(items);
    setSumados(items.length);
    setFilas(null);
    setTexto("");
    setEstado("sumado");
  }

  return (
    <div>
      {estado === "sumado" && (
        <p role="status" className="text-sm text-ahorro font-semibold mb-3">
          ✓ {sumados === 1 ? "Se sumó 1 producto" : `Se sumaron ${sumados} productos`} a tu lista.
        </p>
      )}
      {!filas && (
        <form onSubmit={buscar}>
          <label htmlFor="lista-pegada" className="block text-sm text-tinta-media mb-2">
            Pegá la lista como te llegó por WhatsApp: un producto por renglón o separados por comas.
          </label>
          <textarea
            id="lista-pegada"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            rows={5}
            maxLength={2000}
            placeholder={"2 leches\nyerba\n1 docena de huevos\npan lactal"}
            className="w-full rounded-xl border border-linea bg-papel p-3 text-base text-tinta placeholder:text-tinta-suave focus:outline-none focus:border-tinta"
          />
          <button
            type="submit"
            disabled={estado === "buscando" || !texto.trim()}
            className="mt-2 fondo-marca text-white text-sm font-bold rounded-xl px-4 py-2.5 disabled:opacity-50"
          >
            {estado === "buscando" ? "Buscando…" : "Buscar productos"}
          </button>
          {estado === "error" && <p className="text-sm text-aviso mt-2">No pudimos leer la lista. Probá de nuevo.</p>}
        </form>
      )}
      {filas && (
        <div>
          <ul className="divide-y divide-linea">
            {filas.map((f, i) => (
              <li key={i} className={`py-3 ${f.quitado ? "opacity-50" : ""}`}>
                <p className="text-xs text-tinta-suave">“{f.texto}”</p>
                {f.candidatos.length === 0 ? (
                  <p className="text-sm text-aviso mt-1">No encontramos este producto. Buscalo a mano en Mismo producto.</p>
                ) : (
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <select
                      aria-label={`Producto para “${f.texto}”`}
                      value={f.elegido}
                      disabled={f.quitado}
                      onChange={(e) => cambiar(i, { elegido: Number(e.target.value) })}
                      className="basis-full min-w-0 w-full rounded-lg border border-linea bg-papel px-2 py-2 text-base text-tinta"
                    >
                      {f.candidatos.map((p, j) => (
                        <option key={p.id_producto} value={j}>
                          {nombreParaLista(p)}
                        </option>
                      ))}
                    </select>
                    <input
                      type="number"
                      inputMode="numeric"
                      min={1}
                      max={MAXIMO_UNIDADES}
                      aria-label={`Cantidad de “${f.texto}”`}
                      value={f.cantidadElegida}
                      disabled={f.quitado}
                      onChange={(e) =>
                        cambiar(i, { cantidadElegida: Math.min(Math.max(Number(e.target.value) || 1, 1), MAXIMO_UNIDADES) })
                      }
                      className="w-16 rounded-lg border border-linea bg-papel px-2 py-2 text-base text-tinta numero"
                    />
                    <button
                      onClick={() => cambiar(i, { quitado: !f.quitado })}
                      className="text-sm text-tinta-media underline underline-offset-2 min-h-6 px-1"
                    >
                      {f.quitado ? "volver" : "sacar"}
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
          {paraSumar.length > lugar && (
            <p className="text-sm text-aviso mt-2">
              Tu lista tiene lugar para {lugar} {lugar === 1 ? "producto más" : "productos más"}: se suman los primeros.
            </p>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              onClick={sumarTodo}
              disabled={paraSumar.length === 0}
              className="fondo-marca text-white text-sm font-bold rounded-xl px-4 py-2.5 disabled:opacity-50"
            >
              Sumar {paraSumar.length} a mi lista
            </button>
            <button
              onClick={() => {
                setFilas(null);
                setEstado("");
              }}
              className="text-sm text-tinta-media underline underline-offset-2 px-2"
            >
              Volver a pegar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default PegarLista;
