import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router";
import ListadoPromos from "../components/ListadoPromos";
import BuscadorProducto from "../components/BuscadorProducto";
import type { Seleccion } from "../components/FiltroCategorias";
import { obtenerPromosMapa } from "../api/client";
import { useZona } from "../contexto/zona";
import type { PromoMapa, SucursalMapa } from "../types";
import { formatearNumero } from "../utils/formato";
import { nombreCategoria, nombreRubro } from "../utils/nombres";
import { rubroDesdeSlug } from "../utils/rubros";
import { senal } from "../utils/senales";
import { rotuloZona } from "../utils/zona";

/** Como la vista del mapa: el tope de la API es 6000. */
const PROMOS_POR_RUBRO = 5000;

/*
  Las promos de una categoria cerca de tu zona (openspec
  promos-navegables-y-mes-en-gastos): se llega desde "Ver todas" en la
  vidriera, tiene su propia direccion (/promos/limpieza) para compartirla y cada
  promo lleva "Avisame". La API filtra el rubro en memoria: viaja solo ese
  rubro, no las 5000 promos de todo. Cuenta como la vidriera (mismo circulo
  alrededor de la zona, sin vencidas), asi "Limpieza · 185 promos" en la fila
  son las mismas 185 de esta pagina.
*/
function PromosRubroPage() {
  const { rubro: slug = "" } = useParams();
  const { zona, lista } = useZona();
  const [promos, setPromos] = useState<PromoMapa[]>([]);
  const [sucursales, setSucursales] = useState<Record<string, SucursalMapa>>({});
  const [hayMas, setHayMas] = useState(false);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState("");
  const [filtro, setFiltro] = useState<Seleccion>(null);

  // Se espera a saber si hay zona, para no pedir el pais y enseguida la zona.
  const firma = lista ? JSON.stringify([slug, zona?.latitud ?? null, zona?.longitud ?? null, busqueda.trim()]) : "";
  const [firmaPedida, setFirmaPedida] = useState("");
  if (firma !== firmaPedida) {
    setFirmaPedida(firma);
    setCargando(true);
  }

  useEffect(() => {
    if (!firma) return;
    const [rubro, latitud, longitud, texto] = JSON.parse(firma) as [string, number | null, number | null, string];
    let cancelado = false;
    const timeoutId = setTimeout(
      () => {
        obtenerPromosMapa({
          rubro,
          busqueda: texto,
          limite: PROMOS_POR_RUBRO,
          cerca: latitud !== null && longitud !== null ? { latitud, longitud } : undefined,
        })
          .then((r) => {
            if (cancelado) return;
            setPromos(r.promos);
            setSucursales(r.sucursales);
            setHayMas(r.hay_mas);
            setError(null);
            setCargando(false);
          })
          .catch((e) => {
            if (cancelado) return;
            setError(e.message);
            setCargando(false);
          });
      },
      texto ? 300 : 0,
    );
    return () => {
      cancelado = true;
      clearTimeout(timeoutId);
    };
  }, [firma]);

  // Una señal anonima por categoria abierta (openspec senales-anonimas): cambiar
  // la zona sin cambiar de categoria no manda otra.
  const senalEnviada = useRef<string | null>(null);
  useEffect(() => {
    if (!lista || !slug || senalEnviada.current === slug) return;
    senalEnviada.current = slug;
    senal({ tipo: "vista_rubro", rubro: slug }, zona);
  }, [slug, lista, zona]);

  const nombre = promos[0]?.rubro ? nombreRubro(promos[0].rubro) : nombreRubro(rubroDesdeSlug(slug));
  const lugar = zona ? `cerca de ${rotuloZona(zona)}` : "en todo el país";

  const categorias = useMemo(() => {
    const cuenta = new Map<string, number>();
    for (const p of promos) if (p.categoria) cuenta.set(p.categoria, (cuenta.get(p.categoria) ?? 0) + 1);
    return [...cuenta.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  }, [promos]);

  // Un filtro de una categoria que ya no esta (otra zona, otra busqueda) se suelta.
  const filtroVigente = filtro && categorias.some(([c]) => c === filtro.valor) ? filtro : null;
  const vacia = !cargando && !error && promos.length === 0 && !busqueda.trim();

  return (
    <div className="max-w-4xl mx-auto">
      <Link to="/" className="text-sm font-medium text-marca hover:underline">
        ← Todas las promos
      </Link>
      <header className="mt-3 mb-5">
        <h1 className="font-display text-3xl text-tinta mb-1">Promos de {nombre}</h1>
        <p className="text-tinta-media">
          Las de hoy {lugar}. Tocá 🔔 Avisame en un producto y te avisamos cuando vuelva a estar de oferta.
        </p>
      </header>

      {vacia ? (
        <div className="text-sm text-tinta-media bg-papel-hundido rounded-xl px-4 py-3">
          <p>
            No hay promos de {nombre} {lugar} hoy.
          </p>
          <Link to="/" className="mt-2 inline-block font-medium text-marca hover:underline">
            Volver a la vidriera
          </Link>
        </div>
      ) : (
        <>
          <div className="mb-4">
            <BuscadorProducto busqueda={busqueda} onBusquedaChange={setBusqueda} />
          </div>

          {categorias.length > 1 && (
            <div role="group" aria-label={`Filtrar ${nombre}`} className="flex flex-wrap gap-2 mb-5">
              <Chip activo={filtroVigente === null} onClick={() => setFiltro(null)} texto="Todas" />
              {categorias.map(([categoria, cantidad]) => (
                <Chip
                  key={categoria}
                  activo={filtroVigente?.valor === categoria}
                  onClick={() =>
                    setFiltro(filtroVigente?.valor === categoria ? null : { tipo: "categoria", valor: categoria })
                  }
                  texto={`${nombreCategoria(categoria)} · ${formatearNumero(cantidad)}`}
                />
              ))}
            </div>
          )}

          <ListadoPromos
            promos={promos}
            sucursales={sucursales}
            cargando={cargando}
            error={error}
            hayMas={hayMas}
            filtro={filtroVigente}
            busqueda={busqueda}
            lugar={lugar}
            recorte={zona ? "Buscá un producto para afinar." : "Elegí tu zona arriba para ver las de cerca."}
            conAvisame
          />
        </>
      )}
    </div>
  );
}

function Chip({ activo, onClick, texto }: { activo: boolean; onClick: () => void; texto: string }) {
  return (
    <button
      type="button"
      aria-pressed={activo}
      onClick={onClick}
      className={`rounded-full border px-3 py-1.5 text-xs transition-colors ${
        activo ? "border-marca bg-marca-tenue text-marca font-semibold" : "border-linea-fuerte text-tinta-media hover:bg-papel-hundido"
      }`}
    >
      {texto}
    </button>
  );
}

export default PromosRubroPage;
