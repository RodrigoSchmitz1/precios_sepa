/*
  Vive aparte porque la usan la fila del listado y el popup del mapa: con una
  copia en cada lado, cambiar una etiqueta dejaba a las dos diciendo cosas
  distintas sobre la misma promo.
*/

/*
  Con que evidencia se sostiene el descuento. Es la unica dimension del sitio
  donde la paleta categorica entra limpia: son TRES valores, contra los trece
  rubros y las dieciseis cadenas, que no se pueden pintar con cuatro slots sin
  inventar tonos que no pasan los chequeos de daltonismo.
  
  El color va SIEMPRE con su palabra, nunca solo: quien no distingue el verde
  del ocre tiene que poder leer lo mismo. Y el orden es de mayor a menor
  respaldo, asi que el color acompana una escala de confianza y no una
  identidad.
*/
export const EVIDENCIA = {
  leyenda: {
    // Solo el color del texto, para donde no hay lugar para la pildora.
    color: "text-ahorro",
    // El texto dice QUE esta declarado y POR QUIEN. "Declarada" a secas no se
    // entendia -si hablaba del precio, de la promo o de la sucursal- y
    // "verificado" sin decir contra que tampoco: la pregunta obvia es
    // verificado por quien.
    texto: "lo declara la cadena",
    clase: "bg-ahorro-tenue text-ahorro border-ahorro-borde",
    ayuda: "La cadena informa el porcentaje de descuento y coincide con la diferencia entre sus propios precios.",
  },
  mercado: {
    color: "text-dato-azul",
    texto: "verificado con otras cadenas",
    clase: "bg-dato-azul-tenue text-dato-azul border-dato-azul/25",
    ayuda: "El precio de promo se sostiene frente al del mismo producto en otras empresas, no solo frente a la lista propia.",
  },
  sin_verificar: {
    color: "text-aviso",
    texto: "nadie lo confirma",
    clase: "bg-aviso-tenue text-aviso border-aviso/25",
    ayuda: "Solo se sabe que el descuento es chico como para no ser inverosimil. La cadena no lo declara y el mercado no lo respalda.",
  },
} as const;
