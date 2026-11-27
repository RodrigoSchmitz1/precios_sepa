import { lazy, Suspense, useEffect, useState } from "react";
import { dondeComprarLista } from "../api/client";
import { useZona } from "../contexto/zona";
import type { ItemLista, ResultadoDondeComprar } from "../types";
import { formatearNumero, formatearPesos } from "../utils/formato";
import { DIFERENCIA_CASI_IGUAL_PCT } from "../utils/titularProducto";
import { RADIO_CERCA_KM } from "../utils/zona";
// El mapa (Leaflet) se descarga recien cuando hay que dibujarlo (app-para-el-usuario):
// era lo que mas pesaba en la primera carga de toda la app.
const MapaZona = lazy(() => import("./MapaZona"));

/*
  Donde comprar Mi compra cerca (openspec mi-compra): la lista en 1, 2 o 3
  cadenas con sucursal cerca de la zona. Viene de "Donde comprarla cerca" de Tu
  canasta, pero con productos exactos y el precio de cada cadena para todo el
  pais: la sucursal es la mas cercana de esa cadena, para ubicarse en el mapa,
  no un precio de esa sucursal. Se muestran las tres opciones porque la
  pregunta real es "cuanto me ahorro si hago una parada mas".
*/

const RADIOS_KM = [1, RADIO_CERCA_KM, 5];

type Estado = { firma: string; resultado?: ResultadoDondeComprar; error?: string };

/** plegado: Mi compra la muestra cerrada, debajo de la cifra (app-para-el-usuario). */
export default function DondeComprarLista({ lista, plegado = false }: { lista: ItemLista[]; plegado?: boolean }) {
  const [abierta, setAbierta] = useState(!plegado);
  const { zona, lista: zonaLista } = useZona();
  const [radioKm, setRadioKm] = useState(RADIO_CERCA_KM);
  const [paradas, setParadas] = useState(1);
  const [estado, setEstado] = useState<Estado | null>(null);
  const items = lista.map((i) => ({ id_producto: i.id_producto, cantidad: i.cantidad }));
  const firma = zona ? JSON.stringify([items, zona.latitud, zona.longitud, radioKm]) : "";

  useEffect(() => {
    if (!zona || items.length === 0 || !abierta) return;
    let vigente = true;
    dondeComprarLista(items, zona.latitud, zona.longitud, radioKm)
      .then((resultado) => vigente && setEstado({ firma, resultado }))
      .catch((error) => vigente && setEstado({ firma, error: error instanceof Error ? error.message : "No se pudo calcular." }));
    return () => {
      vigente = false;
    };
    // firma resume items, zona y radio.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firma, abierta]);

  if (lista.length === 0) return null;

  return (
    <section className="tarjeta p-5 sm:p-6 mb-10" aria-labelledby="titulo-donde-comprar">
      <h2 id="titulo-donde-comprar" className="text-lg font-bold text-tinta mb-1">
        {plegado ? (
          <button
            type="button"
            aria-expanded={abierta}
            onClick={() => setAbierta((a) => !a)}
            className="w-full flex items-center justify-between gap-3 min-h-11 text-left"
          >
            Dónde comprarla cerca, en 1, 2 o 3 súper
            <span aria-hidden="true" className={`text-marca transition-transform ${abierta ? "rotate-45" : ""}`}>＋</span>
          </button>
        ) : (
          "Dónde comprarla cerca"
        )}
      </h2>
      {!abierta ? null : !zona && !zonaLista ? (
        <p role="status" className="text-sm text-tinta-suave">Cargando…</p>
      ) : !zona ? (
        <p className="text-sm text-tinta-media">Elegí tu zona arriba y te decimos en qué súper cercanos conviene hacer la compra, en una, dos o tres paradas.</p>
      ) : (
        <Contenido
          estado={estado?.firma === firma ? estado : null}
          radioKm={radioKm}
          onRadio={setRadioKm}
          paradas={paradas}
          onParadas={setParadas}
          punto={{ latitud: zona.latitud, longitud: zona.longitud }}
        />
      )}
    </section>
  );
}

function Contenido({
  estado,
  radioKm,
  onRadio,
  paradas,
  onParadas,
  punto,
}: {
  estado: Estado | null;
  radioKm: number;
  onRadio: (r: number) => void;
  paradas: number;
  onParadas: (n: number) => void;
  punto: { latitud: number; longitud: number };
}) {
  const resultado = estado?.resultado;
  const opciones = resultado?.opciones ?? [];
  const opcion = opciones.find((o) => o.max_sucursales === paradas) ?? opciones[0];
  const unaSola = opciones.find((o) => o.max_sucursales === 1);
  const masRadio = RADIOS_KM.find((r) => r > radioKm);

  return (
    <>
      <p className="text-sm text-tinta-media mb-4">
        Con el precio de cada cadena para todo el país, en las que tienen sucursal a menos de {formatearNumero(radioKm)} km del centro de tu zona.
      </p>
      <div className="flex flex-wrap gap-2 mb-4" role="group" aria-label="Radio">
        {RADIOS_KM.map((r) => (
          <button
            key={r}
            type="button"
            aria-pressed={r === radioKm}
            onClick={() => onRadio(r)}
            className={`rounded-full min-h-11 px-4 text-sm font-semibold ${r === radioKm ? "fondo-marca text-white" : "bg-marca-tenue text-marca"}`}
          >
            {formatearNumero(r)} km
          </button>
        ))}
      </div>

      {!estado && <p className="text-sm text-tinta-suave">Calculando…</p>}
      {estado?.error && <p className="text-sm text-tinta-media">{estado.error}</p>}

      {resultado && opciones.length === 0 && (
        <p className="text-sm text-tinta-media">
          No hay súper con estos productos a menos de {formatearNumero(radioKm)} km.{" "}
          {masRadio && (
            <button type="button" className="text-marca font-bold underline min-h-11" onClick={() => onRadio(masRadio)}>
              Buscar a {formatearNumero(masRadio)} km
            </button>
          )}
        </p>
      )}

      {opcion && (
        <>
          <div className="grid grid-cols-3 gap-2 mb-4" role="group" aria-label="Paradas">
            {opciones.map((o) => (
              <button
                key={o.max_sucursales}
                type="button"
                aria-pressed={o.max_sucursales === opcion.max_sucursales}
                onClick={() => onParadas(o.max_sucursales)}
                className={`rounded-2xl min-h-14 px-2 text-left ${o.max_sucursales === opcion.max_sucursales ? "fondo-marca text-white" : "bg-papel-hundido text-tinta"}`}
              >
                <span className="block text-xs font-semibold">{o.max_sucursales === 1 ? "1 súper" : `Hasta ${o.max_sucursales}`}</span>
                <span className="block text-base font-bold numero">{formatearPesos(o.total)}</span>
              </button>
            ))}
          </div>

          {opcion.productos_cubiertos < (resultado?.productos ?? 0) && (
            <p className="text-sm text-tinta-media mb-3">
              Cubre {opcion.productos_cubiertos} de tus {resultado?.productos} productos: el resto no lo informa ningún súper cerca.
            </p>
          )}
          {unaSola && opcion.max_sucursales > 1 && opcion.productos_cubiertos === unaSola.productos_cubiertos && unaSola.total > opcion.total && (
            // Menos del 5%: casi lo mismo, con el mismo umbral que Tu lista y el detalle del producto.
            ((unaSola.total - opcion.total) / opcion.total) * 100 < DIFERENCIA_CASI_IGUAL_PCT ? (
              <p className="text-sm text-tinta-media mb-3">
                Hacer más paradas ahorra solo {formatearPesos(unaSola.total - opcion.total)}: es casi lo mismo que comprar todo en un súper.
              </p>
            ) : (
              <p className="text-sm text-ahorro font-semibold mb-3">
                Ahorrás {formatearPesos(unaSola.total - opcion.total)} contra hacer toda la compra en un solo súper.
              </p>
            )
          )}

          <ul className="grid gap-3 mb-4">
            {opcion.sucursales.map((s) => (
              <li key={s.id} className="rounded-2xl bg-papel-hundido p-3">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="text-base font-bold text-tinta">{s.cadena}</p>
                  <p className="text-base font-bold text-tinta numero">{formatearPesos(s.subtotal)}</p>
                </div>
                <p className="text-xs text-tinta-suave">
                  {[s.direccion, s.localidad].filter(Boolean).join(", ")} · a {formatearNumero(s.distancia_km)} km
                </p>
                <p className="mt-1 text-sm text-tinta-media">{s.productos.map((p) => p.descripcion).join(", ")}</p>
              </li>
            ))}
          </ul>
          <div className="rounded-2xl overflow-hidden">
            <Suspense fallback={<div className="h-full grid place-items-center text-sm text-tinta-suave">Cargando el mapa…</div>}>
              <MapaZona punto={punto} radioKm={radioKm} onElegirPunto={() => {}} sucursales={opcion.sucursales} />
            </Suspense>
          </div>
        </>
      )}
    </>
  );
}
