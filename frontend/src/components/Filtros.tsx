const PROVINCIAS: { codigo: string; nombre: string }[] = [
  { codigo: "", nombre: "Todas las provincias" },
  { codigo: "AR-B", nombre: "Buenos Aires" },
  { codigo: "AR-C", nombre: "CABA" },
  { codigo: "AR-X", nombre: "Cordoba" },
  { codigo: "AR-S", nombre: "Santa Fe" },
  { codigo: "AR-M", nombre: "Mendoza" },
  { codigo: "AR-U", nombre: "Chubut" },
];

type Props = {
  busqueda: string;
  onBusquedaChange: (valor: string) => void;
  provincia: string;
  onProvinciaChange: (valor: string) => void;
};

function Filtros({ busqueda, onBusquedaChange, provincia, onProvinciaChange }: Props) {
  return (
    <div className="flex gap-3 mb-6">
      <input
        type="text"
        placeholder="Buscar producto (ej: colchoneta, vino, yerba)"
        value={busqueda}
        onChange={(e) => onBusquedaChange(e.target.value)}
        className="flex-1 border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
      />
      <select
        value={provincia}
        onChange={(e) => onProvinciaChange(e.target.value)}
        className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
      >
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
