import { useEffect, useState } from "react";
import { optimizarCompra } from "../api/client";
import MapaZona from "./MapaZona";
import FilaDeCifras from "./FilaDeCifras";
import { formatearNumero, formatearPesos } from "../utils/formato";
import type { ItemCanastaIA, OpcionCompra, ResultadoOptimizacion } from "../types";

/*
  Donde comprar la canasta: la compra dividida entre las sucursales cercanas.

  Muestra las tres opciones (1, 2 y 3 sucursales) y no solo la mejor, porque la
  pregunta real no es "cual es el minimo" sino "cuanto me ahorro si hago una
  parada mas". Con una sola cifra, esa decision no se puede tomar.

  La distancia se informa pero no se optimiza: ponerle precio a un kilometro
  exige suponer como se mueve cada persona. Se usa solo para desempatar entre
  sucursales que cuestan lo mismo, y ahi elige la mas cercana.
*/

const RADIOS_KM = [1, 2, 5];

type Props = {
  items: ItemCanastaIA[];
};

type Punto = { latitud: number; longitud: number };
type Estado = { firma: string; resultado?: ResultadoOptimizacion; error?: string };

function firmaDe(items: ItemCanastaIA[], punto: Punto, radioKm: number): string {
  return JSON.stringify({
    i: items.map((x) => `${x.categoria}|${x.gama}|${x.unidad}|${x.cantidad}`).sort(),
    p: [punto.latitud.toFixed(4), punto.longitud.toFixed(4)],
    r: radioKm,
  });
}

/** "Pan, Arroz y 3 mas": la lista completa de 20 categorias tapa el resto. */
function resumirItems(nombres: string[]): string {
  if (nombres.length <= 3) return nombres.join(", ");
  return `${nombres.slice(0, 3).join(", ")} y ${nombres.length - 3} mas`;
}

function Opcion({ opcion, referencia }: { opcion: OpcionCompra; referencia: number | null }) {
  const ahorro = referencia !== null ? referencia - opcion.total : 0;

  return (
    <li className="border-b border-linea py-4">
      <div className="flex items-baseline justify-between gap-4 mb-2">
        <h4 className="text-sm font-medium text-tinta">
          {opcion.max_sucursales === 1 ? "En una sucursal" : `En ${opcion.max_sucursales} sucursales`}
        </h4>
        <div className="text-right">
          <p className="font-display text-2xl text-tinta leading-none">{formatearPesos(opcion.total)}</p>
          {ahorro > 0 && (
            <p className="numero text-xs text-ahorro">ahorras {formatearPesos(ahorro)}</p>
          )}
        </div>
      </div>

      <ul className="space-y-1.5">
        {opcion.sucursales.map((s) => (
          <li key={s.id} className="flex items-baseline gap-3 text-xs">
            <span className="text-tinta-media min-w-0 flex-1 truncate">
              <span className="text-tinta">{s.cadena}</span>
              {s.direccion && <span className="text-tinta-suave"> · {s.direccion}</span>}
              <span className="numero text-tinta-suave"> · {s.distancia_km} km</span>
              {s.equivalentes > 0 && (
                <span className="text-tinta-suave" title="Otras sucursales de la zona con exactamente los mismos precios">
                  {" "}
                  (+{s.equivalentes} igual{s.equivalentes > 1 ? "es" : ""})
                </span>
              )}
            </span>
            <span className="numero text-tinta-media shrink-0">{formatearPesos(s.subtotal)}</span>
          </li>
        ))}
      </ul>

      <p className="text-[11px] text-tinta-suave mt-1.5 leading-snug">
        {opcion.sucursales
          .map((s) => `${s.cadena}: ${resumirItems(s.items.map((i) => i.categoria))}`)
          .join(" · ")}
      </p>
    </li>
  );
}

function DondeComprarla({ items }: Props) {
  const [punto, setPunto] = useState<Punto | null>(null);
  const [radioKm, setRadioKm] = useState(2);
  const [estado, setEstado] = useState<Estado | null>(null);
  const [errorUbicacion, setErrorUbicacion] = useState<string | null>(null);

  const firma = punto ? firmaDe(items, punto, radioKm) : "";

  useEffect(() => {
    if (!punto || items.length === 0) return;
    let cancelado = false;
    optimizarCompra(items, punto.latitud, punto.longitud, radioKm)
      .then((resultado) => {
        if (!cancelado) setEstado({ firma, resultado });
      })
      .catch((err) => {
        if (!cancelado) setEstado({ firma, error: err.message });
      });
    return () => {
      cancelado = true;
    };
    // firma resume items, punto y radio: recalcula solo cuando cambia algo que
    // altera el resultado, y no en cada render.
  }, [firma, items, punto, radioKm]);

  const vigente = firma && estado?.firma === firma ? estado : null;
  const resultado = vigente?.resultado;
  const mejor = resultado?.opciones.reduce(
    (mejor: OpcionCompra | null, o) => (mejor === null || o.total < mejor.total ? o : mejor),
    null
  );
  const unaSola = resultado?.opciones.find((o) => o.max_sucursales === 1) ?? null;

  const ubicarme = () => {
    setErrorUbicacion(null);
    if (!navigator.geolocation) {
      setErrorUbicacion("Este navegador no puede darnos tu ubicacion. Toca el mapa para elegir la zona.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => setPunto({ latitud: pos.coords.latitude, longitud: pos.coords.longitude }),
      () => setErrorUbicacion("No pudimos leer tu ubicacion. Toca el mapa para elegir la zona.")
    );
  };

  return (
    <section className="mb-8">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-tinta-suave mb-3">
        4 · Donde comprarla
      </h2>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mb-3">
        <button
          onClick={ubicarme}
          className="text-sm font-medium text-ahorro hover:text-ahorro-hover transition-colors"
        >
          Usar mi ubicacion
        </button>
        <span className="text-xs text-tinta-suave">o toca el mapa</span>

        <div className="flex items-center gap-1.5 ml-auto">
          <span className="text-xs text-tinta-suave">Radio</span>
          {RADIOS_KM.map((r) => (
            <button
              key={r}
              onClick={() => setRadioKm(r)}
              className={[
                "numero text-xs rounded-full px-2.5 py-1 border transition-colors",
                r === radioKm
                  ? "border-ahorro-borde bg-ahorro-tenue text-ahorro font-semibold"
                  : "border-linea text-tinta-media hover:border-linea-fuerte",
              ].join(" ")}
            >
              {r} km
            </button>
          ))}
        </div>
      </div>

      {errorUbicacion && <p className="text-xs text-aviso mb-2">{errorUbicacion}</p>}

      <div className="rounded-xl overflow-hidden border border-linea mb-3">
        <MapaZona
          punto={punto}
          radioKm={radioKm}
          onElegirPunto={(latitud, longitud) => setPunto({ latitud, longitud })}
          sucursales={mejor?.sucursales ?? []}
        />
      </div>

      {!punto && (
        <p className="text-sm text-tinta-suave">
          Elegi desde donde salis a comprar y calculamos en que sucursales cercanas conviene comprar cada cosa.
        </p>
      )}

      {punto && vigente === null && <p className="text-sm text-tinta-suave">Buscando sucursales…</p>}

      {vigente?.error && (
        <p className="text-sm text-alerta bg-alerta-tenue border border-alerta/20 rounded-lg px-3 py-2">
          {vigente.error}
        </p>
      )}

      {resultado && resultado.opciones.length === 0 && (
        <p className="text-sm text-tinta-suave">
          No hay sucursales con precios dentro de {resultado.radio_km} km de ese punto. Proba con un radio mas
          grande o mové el punto.
        </p>
      )}

      {resultado && mejor && unaSola && (
        <>
          <div className="mb-4">
            <FilaDeCifras
              cifras={[
                {
                  etiqueta: "Mejor total",
                  valor: formatearPesos(mejor.total),
                  detalle:
                    mejor.max_sucursales === 1
                      ? "en una sola sucursal"
                      : `repartiendo en ${mejor.max_sucursales} sucursales`,
                },
                {
                  etiqueta: "Contra una sola",
                  valor: unaSola.total > mejor.total ? formatearPesos(unaSola.total - mejor.total) : "—",
                  detalle: unaSola.total > mejor.total ? "de diferencia" : "ya es la mejor",
                },
                {
                  etiqueta: "Sucursales en la zona",
                  valor: formatearNumero(resultado.sucursales_en_zona),
                  detalle: `a ${resultado.radio_km} km o menos`,
                },
                {
                  etiqueta: "Categorias cubiertas",
                  valor: `${mejor.items_cubiertos} de ${items.length}`,
                  detalle: "con precio en la zona",
                },
              ]}
            />
          </div>

          <ul className="border-t border-linea">
            {resultado.opciones.map((opcion) => (
              <Opcion key={opcion.max_sucursales} opcion={opcion} referencia={unaSola.total} />
            ))}
          </ul>

          {resultado.items_sin_precio.length > 0 && (
            <p className="text-xs text-aviso mt-3">
              Sin precio en la zona, no entraron al total:{" "}
              {resumirItems(resultado.items_sin_precio.map((i) => i.categoria))}.
            </p>
          )}

          <p className="text-[11px] text-tinta-suave mt-3 leading-relaxed">
            Los kilometros son informativos: no se le pone precio a la distancia, porque eso depende de como se
            mueva cada uno. Solo se usan para desempatar entre sucursales que cuestan lo mismo. Precios del dia,
            por categoria y gama, no por producto puntual.
          </p>
        </>
      )}
    </section>
  );
}

export default DondeComprarla;
