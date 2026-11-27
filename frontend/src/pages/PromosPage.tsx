import { lazy, Suspense, useEffect, useRef } from "react";
import { Link, useSearchParams } from "react-router";
import Presentacion from "../components/Presentacion";
import { FilasDeVidriera, PromosDelDia } from "../components/VidrieraPromos";
import PromosBancariasHoy from "../components/PromosBancariasHoy";
import { useVidriera } from "../contexto/useVidriera";

/*
  El mapa se carga aparte: el mapa de Leaflet y las 5000 promos de la zona
  visible no se piden hasta que alguien toca "Ver en el mapa" (openspec
  promos-navegables-y-mes-en-gastos).
*/
const VistaMapaPromos = lazy(() => import("../components/VistaMapaPromos"));

function PromosPage() {
  const [parametros] = useSearchParams();
  const conMapa = parametros.get("mapa") === "1";
  const vidriera = useVidriera(!conMapa);

  /*
    Al abrir o cerrar el mapa, y al entrar por un link con el mapa abierto, se
    lleva la vista hasta las promos. Al entrar a la portada sin mapa no se mueve
    nada: las promos del dia ya estan cerca de arriba.
  */
  const ancla = useRef<HTMLDivElement>(null);
  const previo = useRef<boolean | null>(null);
  useEffect(() => {
    const cambio = previo.current !== null && previo.current !== conMapa;
    if (cambio || (previo.current === null && conMapa)) {
      ancla.current?.scrollIntoView?.({ block: "start" });
    }
    previo.current = conMapa;
  }, [conMapa]);

  /*
    Las promos del dia van pegadas a la presentacion (promos-arriba-en-la-portada):
    en el celular, apenas debajo del buscador y de las cifras. El mapa se abre en
    el mismo lugar. Las filas por categoria y por super siguen mas abajo.
  */
  const enMedio = (
    <div ref={ancla} className="scroll-mt-20">
      {conMapa ? (
        /* Alto minimo: con el mapa todavia cargando, la pagina quedaba corta y el navegador no podia subir el encabezado. */
        <div className="min-h-screen">
          <header className="mb-5">
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <h2 className="font-display text-3xl text-tinta mb-2">Promos en el mapa</h2>
              <Link to="?" className="text-sm font-medium text-marca hover:underline">
                ← Volver a las promos
              </Link>
            </div>
            <p className="text-tinta-media">Movete por el mapa para ver las promos de cada zona.</p>
          </header>
          <Suspense fallback={<p className="text-sm text-tinta-suave">Cargando el mapa…</p>}>
            <VistaMapaPromos busquedaInicial={parametros.get("q") ?? ""} />
          </Suspense>
        </div>
      ) : (
        <PromosDelDia {...vidriera} />
      )}
    </div>
  );

  return (
    /*
      Mas ancha que las demas paginas (6xl contra 4xl): la vista del mapa tiene
      barra de filtros al costado, y la vidriera usa el ancho para cuatro
      tarjetas por fila.
    */
    <div className="max-w-6xl mx-auto">
      <Presentacion
        enMedio={enMedio}
        despues={
          !conMapa && (
            <>
              {/* Debajo de las promos del dia, para no sacar su titulo de la primera pantalla (promos-bancarias). */}
              <PromosBancariasHoy />
              <div className="mt-10">
                <FilasDeVidriera {...vidriera} />
              </div>
            </>
          )
        }
      />
    </div>
  );
}

export default PromosPage;
