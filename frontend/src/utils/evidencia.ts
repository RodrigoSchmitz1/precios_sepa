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
/*
  "ayuda" es a la vez el tooltip de cada pildora y la explicacion del listado,
  para que las dos digan siempre lo mismo. Esta escrita para quien no sabe que
  es SEPA: que hizo el super, contra que se comparo, y nada mas.
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
    ayuda: "El super anuncia el porcentaje (\"30% de descuento\") y coincide con la rebaja de sus precios.",
  },
  mercado: {
    color: "text-dato-azul",
    texto: "verificado con otras cadenas",
    clase: "bg-dato-azul-tenue text-dato-azul border-dato-azul/25",
    ayuda: "El super no anuncia el porcentaje, pero el precio rebajado no es sospechosamente bajo al lado de lo que cobran otras cadenas por el mismo producto.",
  },
  sin_verificar: {
    color: "text-aviso",
    // "nadie lo confirma" sonaba a sospecha, y es solo que no hay con que
    // comparar. Ademas queda en paralelo con "verificado con otras cadenas".
    texto: "sin verificar con otras cadenas",
    clase: "bg-aviso-tenue text-aviso border-aviso/25",
    ayuda: "Ninguna otra cadena vende ese mismo producto, asi que no hay con que compararlo.",
  },
} as const;

/** Del respaldo mas firme al mas debil: el orden en que se explican. */
export const NIVELES_EVIDENCIA = ["leyenda", "mercado", "sin_verificar"] as const;
