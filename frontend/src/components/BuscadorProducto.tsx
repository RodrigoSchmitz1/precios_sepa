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
      <span className="absolute left-0 top-1/2 -translate-y-1/2 text-tinta-suave text-sm" aria-hidden="true">
        ⌕
      </span>
      <input
        type="search"
        placeholder="Buscar producto en las promos (ej: yerba, colchoneta, vino)"
        value={busqueda}
        onChange={(e) => onBusquedaChange(e.target.value)}
        aria-label="Buscar producto en las promos"
        className="w-full bg-transparent border-b border-linea-fuerte pl-6 pr-3 py-2.5 text-sm placeholder:text-tinta-suave focus:outline-none focus:border-ahorro"
      />
    </div>
  );
}

export default BuscadorProducto;
