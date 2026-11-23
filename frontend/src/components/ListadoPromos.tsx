import { useMemo, useState } from "react";
import PromoCard from "./PromoCard";
import BotonAvisame from "./BotonAvisame";
import type { Seleccion } from "./FiltroCategorias";
import type { PromoMapa, SucursalMapa } from "../types";
import { formatearNumero } from "../utils/formato";
import { EVIDENCIA, NIVELES_EVIDENCIA } from "../utils/evidencia";
import { nombreCategoria, nombreRubro } from "../utils/nombres";

const TANDA = 60;

type Orden = "sucursales" | "descuento";

/*
  El listado de promos con su orden, sus tandas y la explicacion de la
  evidencia. Era el cuerpo de PromosPage; desde promos-navegables-y-mes-en-gastos
  lo comparten la vista del mapa y la pagina de una categoria, para que las dos
  muestren lo mismo y en el mismo orden.
*/
function ListadoPromos({
  promos,
  sucursales,
  cargando,
  error,
  hayMas,
  filtro,
  busqueda,
  lugar,
  recorte = "Acercá el mapa para ver más.",
  conAvisame = false,
}: {
  promos: PromoMapa[];
  sucursales: Record<string, SucursalMapa>;
  cargando: boolean;
  error: string | null;
  hayMas: boolean;
  filtro: Seleccion;
  busqueda: string;
  /** "en esta zona", "cerca de tu zona": cierra los textos de vacio y de recorte. */
  lugar: string;
  /** Que hacer cuando la respuesta vino recortada. */
  recorte?: string;
  conAvisame?: boolean;
}) {
  const [orden, setOrden] = useState<Orden>("sucursales");

  // El filtro es local: la respuesta ya trae rubro y categoria de cada promo,
  // asi que no hace falta volver a consultar ni gastar una query mas.
  const promosVisibles = useMemo(() => {
    const filtradas = !filtro
      ? promos
      : filtro.tipo === "rubro"
        ? promos.filter((p) => (p.rubro ?? "Otros") === filtro.valor)
        : promos.filter((p) => p.categoria === filtro.valor);
    // La API las manda por descuento; "sucursales" las reordena aca, con el
    // descuento como desempate. sort es estable y se copia para no tocar promos.
    return orden === "descuento"
      ? filtradas
      : [...filtradas].sort((a, b) => b.total_sucursales - a.total_sucursales || b.descuento_pct - a.descuento_pct);
  }, [promos, filtro, orden]);

  /*
    Se renderiza de a tandas: pintar 5000 promos de golpe, con el mapa de
    Leaflet al lado, hace que la pagina se arrastre al scrollear. El reseteo se
    hace comparando durante el render y no con un useEffect (patron de React
    para estado que sigue a otro).
  */
  const [mostradas, setMostradas] = useState(TANDA);
  const [entradaPrevia, setEntradaPrevia] = useState({ filtro, promos, orden });
  if (entradaPrevia.filtro !== filtro || entradaPrevia.promos !== promos || entradaPrevia.orden !== orden) {
    setEntradaPrevia({ filtro, promos, orden });
    setMostradas(TANDA);
  }

  const lote = promosVisibles.slice(0, mostradas);
  const faltan = promosVisibles.length - lote.length;
  const nombreFiltro = filtro ? (filtro.tipo === "rubro" ? nombreRubro(filtro.valor) : nombreCategoria(filtro.valor)) : null;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 mb-3">
        <h2 className="text-base font-bold text-tinta">
          {nombreFiltro ?? "Todas las promos"}
          {!cargando && !error && (
            <span className="numero normal-case tracking-normal font-normal">
              {" · "}
              {formatearNumero(promosVisibles.length)}
              {promosVisibles.length === 1 ? " promo" : " promos"}
            </span>
          )}
        </h2>
        {/*
          Por defecto, las que estan en mas sucursales: ordenada solo por
          descuento, la lista arrancaba con una crema de manos al 70% en una
          sucursal, que casi nadie puede aprovechar.
        */}
        <div role="group" aria-label="Ordenar promos" className="inline-flex rounded-lg border border-linea bg-papel-hundido p-0.5">
          {(
            [
              ["sucursales", "En más sucursales"],
              ["descuento", "Mayor descuento"],
            ] as const
          ).map(([valor, texto]) => (
            <button
              key={valor}
              type="button"
              aria-pressed={orden === valor}
              onClick={() => setOrden(valor)}
              className={`px-2.5 py-1 text-xs rounded-md transition-colors ${
                orden === valor ? "bg-papel text-tinta font-semibold shadow-sm" : "text-tinta-suave hover:text-tinta-media"
              }`}
            >
              {texto}
            </button>
          ))}
        </div>
      </div>

      {cargando && <p className="text-sm text-tinta-suave">Cargando promos…</p>}

      {error && (
        <p className="text-sm text-alerta bg-alerta-tenue border border-alerta/20 rounded-lg px-3 py-2">
          No se pudieron cargar las promos: {error}
        </p>
      )}

      {!cargando && !error && hayMas && (
        <p className="text-xs text-aviso bg-aviso-tenue border border-aviso/20 rounded-lg px-3 py-2 mb-4">
          Mostrando las {formatearNumero(promos.length)} promos con mayor descuento {lugar}. {recorte}
        </p>
      )}

      {!cargando && !error && promosVisibles.length === 0 && (
        <p className="text-sm text-tinta-suave">
          {promos.length === 0
            ? busqueda.trim()
              ? `No hay promos de "${busqueda.trim()}" ${lugar}.`
              : `No se encontraron promos ${lugar}.`
            : `No hay promos de ${nombreFiltro} ${lugar}.`}
        </p>
      )}

      {/*
        De donde sale el respaldo de cada promo: una pregunta y una linea por
        etiqueta, en palabras de quien compra (2026-09-23). Plegada desde
        promos-navegables-y-mes-en-gastos: abierta, en el celular ocupaba media
        pantalla antes de la primera promo de una categoria.
      */}
      {promosVisibles.length > 0 && (
        <details className="text-xs text-tinta-media bg-papel-hundido rounded-lg px-3 py-2.5 mb-4 leading-relaxed">
          <summary className="font-semibold text-tinta cursor-pointer">Cómo sabemos que el descuento es real</summary>
          <ul className="mt-1.5 space-y-1">
            {NIVELES_EVIDENCIA.map((nivel) => (
              <li key={nivel}>
                <strong className={`font-medium ${EVIDENCIA[nivel].color}`}>
                  {EVIDENCIA[nivel].texto.charAt(0).toUpperCase() + EVIDENCIA[nivel].texto.slice(1)}.
                </strong>{" "}
                {EVIDENCIA[nivel].ayuda}
              </li>
            ))}
          </ul>
          <p className="mt-1.5">
            Si un descuento no cierra por ningún lado, la promo no se muestra: por ejemplo, una notebook de
            $1.439.000 &quot;a $214.900&quot;.
          </p>
        </details>
      )}

      <div className="grid gap-3">
        {lote.map((promo, i) => (
          <PromoCard
            key={`${promo.descripcion}-${promo.cadena}-${i}`}
            promo={promo}
            sucursales={sucursales}
            pie={
              conAvisame && promo.id_producto ? (
                <BotonAvisame producto={{ id_producto: promo.id_producto, descripcion: promo.descripcion }} compacto />
              ) : undefined
            }
          />
        ))}
      </div>

      {faltan > 0 && (
        <button
          onClick={() => setMostradas(mostradas + TANDA)}
          className="w-full py-3 text-sm font-medium text-tinta-media hover:bg-papel-hundido border-b border-linea transition-colors"
        >
          Ver {Math.min(TANDA, faltan)} promos más
          <span className="numero text-tinta-suave"> ({formatearNumero(faltan)} restantes)</span>
        </button>
      )}
    </div>
  );
}

export default ListadoPromos;
