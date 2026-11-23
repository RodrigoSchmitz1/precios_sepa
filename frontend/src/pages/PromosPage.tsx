import { lazy, Suspense, useEffect, useRef } from "react";
import { Link, useSearchParams } from "react-router";
import Presentacion from "../components/Presentacion";
import VidrieraPromos from "../components/VidrieraPromos";

/*
  El mapa se carga aparte: Leaflet y las 5000 promos de la zona visible no
  viajan hasta que alguien toca "Ver en el mapa" (openspec
  promos-navegables-y-mes-en-gastos).
*/
const VistaMapaPromos = lazy(() => import("../components/VistaMapaPromos"));

function PromosPage() {
  const [parametros] = useSearchParams();
  const conMapa = parametros.get("mapa") === "1";

  /*
    Las promos van debajo de la presentacion: al abrir o cerrar el mapa, y al
    entrar por un link con el mapa abierto, se lleva la vista hasta ellas. Al
    entrar a la portada sin mapa no se mueve nada.
  */
  const encabezado = useRef<HTMLElement>(null);
  const previo = useRef<boolean | null>(null);
  useEffect(() => {
    const cambio = previo.current !== null && previo.current !== conMapa;
    if (cambio || (previo.current === null && conMapa)) {
      encabezado.current?.scrollIntoView?.({ block: "start" });
    }
    previo.current = conMapa;
  }, [conMapa]);

  return (
    /*
      Mas ancha que las demas paginas (6xl contra 4xl): la vista del mapa tiene
      barra de filtros al costado, y la vidriera usa el ancho para cuatro
      tarjetas por fila.
    */
    <div className="max-w-6xl mx-auto">
      <Presentacion />

      {/*
        El titulo de la portada es la presentacion del sitio; las promos son su
        primera seccion, asi que su encabezado baja a h2.
      */}
      <header
        ref={encabezado}
        className="mb-5 pt-8 border-t border-linea scroll-mt-20"
      >
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <h2 className="font-display text-3xl text-tinta mb-2">
            {conMapa ? "Promos en el mapa" : "Promos vigentes"}
          </h2>
          {conMapa && (
            <Link
              to="?"
              className="text-sm font-medium text-marca hover:underline"
            >
              ← Volver a la vidriera
            </Link>
          )}
        </div>
        <p className="text-tinta-media">
          {conMapa
            ? "Movete por el mapa para ver las promos de cada zona."
            : "Descuentos publicados hoy por las cadenas, por categoría y por súper."}
        </p>
      </header>

      {/* Alto minimo: con el mapa todavia cargando, la pagina quedaba corta y el navegador no podia subir el encabezado. */}
      <div className="min-h-screen">
        {conMapa ? (
          <Suspense
            fallback={
              <p className="text-sm text-tinta-suave">Cargando el mapa…</p>
            }
          >
            <VistaMapaPromos busquedaInicial={parametros.get("q") ?? ""} />
          </Suspense>
        ) : (
          <VidrieraPromos />
        )}
      </div>
    </div>
  );
}

export default PromosPage;
