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
