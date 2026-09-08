const NOMBRES_PROVINCIA: Record<string, string> = {
  "AR-A": "Salta",
  "AR-B": "Buenos Aires",
  "AR-C": "CABA",
  "AR-D": "San Luis",
  "AR-E": "Entre Rios",
  "AR-F": "La Rioja",
  "AR-G": "Santiago del Estero",
  "AR-H": "Chaco",
  "AR-J": "San Juan",
  "AR-K": "Catamarca",
  "AR-L": "La Pampa",
  "AR-M": "Mendoza",
  "AR-N": "Misiones",
  "AR-P": "Formosa",
  "AR-Q": "Neuquen",
  "AR-R": "Rio Negro",
  "AR-S": "Santa Fe",
  "AR-T": "Tucuman",
  "AR-U": "Chubut",
  "AR-V": "Tierra del Fuego",
  "AR-W": "Corrientes",
  "AR-X": "Cordoba",
  "AR-Y": "Jujuy",
  "AR-Z": "Santa Cruz",
  "Buenos Aires": "Buenos Aires",
};

export function nombreProvincia(codigo: string): string {
  return NOMBRES_PROVINCIA[codigo] ?? codigo;
}

/*
  Lista para los desplegables, ordenada por nombre. Se arma desde el mismo mapa
  de arriba para no tener dos fuentes que se desincronicen: el filtro de promos
  tenia siete provincias escritas a mano y dejaba afuera a las demas, aunque los
  datos tienen sucursales en casi todo el pais (Neuquen, Tucuman, Jujuy...).

  Se excluye la clave "Buenos Aires", que no es un codigo ISO sino un alias que
  aparece en el crudo cuando la cadena reporta el nombre en vez del codigo.
*/
export const PROVINCIAS: { codigo: string; nombre: string }[] = Object.entries(NOMBRES_PROVINCIA)
  .filter(([codigo]) => codigo.startsWith("AR-"))
  .map(([codigo, nombre]) => ({ codigo, nombre }))
  .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
