type Props = {
  busqueda: string;
  onBusquedaChange: (valor: string) => void;
};

/*
  Busca entre las promos. Vive debajo del mapa, pegado al listado, porque es ahi
  donde uno mira el resultado; arriba del mapa se confundia con un buscador de
  lugares. Igual filtra tambien los marcadores: la busqueda viaja a la API.
*/
function BuscadorProducto({ busqueda, onBusquedaChange }: Props) {
  return (
    <div className="relative">
      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-tinta-suave text-base z-10" aria-hidden="true">
        ⌕
      </span>
      <input
        type="search"
        placeholder="Buscar producto en las promos (ej: yerba, colchoneta, vino)"
        value={busqueda}
        onChange={(e) => onBusquedaChange(e.target.value)}
        aria-label="Buscar producto en las promos"
        className="w-full bg-papel rounded-2xl shadow-tarjeta pl-10 pr-4 py-3 text-sm placeholder:text-tinta-suave focus:outline-none focus:ring-2 focus:ring-marca/40"
      />
    </div>
  );
}

export default BuscadorProducto;
