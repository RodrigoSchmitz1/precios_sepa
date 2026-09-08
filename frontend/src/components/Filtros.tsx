import { PROVINCIAS } from "../utils/provincias";

type Props = {
  busqueda: string;
  onBusquedaChange: (valor: string) => void;
  provincia: string;
  onProvinciaChange: (valor: string) => void;
};

function Filtros({ busqueda, onBusquedaChange, provincia, onProvinciaChange }: Props) {
  return (
    <div className="flex flex-col sm:flex-row gap-2.5">
      <div className="relative flex-1">
        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-tinta-suave text-sm" aria-hidden="true">
          ⌕
        </span>
        <input
          type="search"
          placeholder="Buscar producto (ej: yerba, colchoneta, vino)"
          value={busqueda}
          onChange={(e) => onBusquedaChange(e.target.value)}
          aria-label="Buscar producto"
          className="w-full bg-papel border border-linea rounded-xl pl-9 pr-3 py-2.5 text-sm focus:outline-none focus:border-ahorro"
        />
      </div>

      {/*
        La lista sale de utils/provincias: antes estaban escritas a mano siete
        provincias y las demas quedaban inalcanzables desde el filtro.
      */}
      <select
        value={provincia}
        onChange={(e) => onProvinciaChange(e.target.value)}
        aria-label="Filtrar por provincia"
        className="bg-papel border border-linea rounded-xl px-3 py-2.5 text-sm text-tinta-media focus:outline-none focus:border-ahorro"
      >
        <option value="">Todas las provincias</option>
        {PROVINCIAS.map((p) => (
          <option key={p.codigo} value={p.codigo}>
            {p.nombre}
          </option>
        ))}
      </select>
    </div>
  );
}

export default Filtros;
