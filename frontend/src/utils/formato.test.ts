/*
  Lo que se lee en pantalla: importes, variaciones, fechas y tamanos.

  Cada caso sale de un error que ya paso o de un borde que la fuente manda de
  verdad. Intl separa el "$" del numero con un espacio duro, asi que se
  normaliza antes de comparar: lo que importa es el numero y su formato es-AR.
*/
import { describe, expect, it } from "vitest";
import {
  fechaEnPalabras,
  formatearPesos,
  formatearTamano,
  formatearVariacion,
  mesEnPalabras,
  porcentajeEntero,
  precioPorUnidad,
  tamanoQueFalta,
} from "./formato";

const espacios = (texto: string) => texto.replace(/\s/g, " ");

describe("formatearPesos", () => {
  it("separa los miles con punto y no muestra centavos", () => {
    // Las promos imprimian "$184990" crudo.
    expect(espacios(formatearPesos(184990))).toBe("$ 184.990");
    expect(espacios(formatearPesos(3.49))).toBe("$ 3");
  });
});

describe("formatearVariacion", () => {
  it("lleva siempre el signo y coma decimal", () => {
    expect(formatearVariacion(2.345)).toBe("+2,35%");
    expect(formatearVariacion(-1.5)).toBe("−1,50%");
    expect(formatearVariacion(0.3, 1)).toBe("+0,3%");
  });

  it("un cero no tiene signo, tampoco el que sale de redondear", () => {
    expect(formatearVariacion(0)).toBe("0,00%");
    expect(formatearVariacion(-0.004)).toBe("0,00%");
    expect(formatearVariacion(0.004)).toBe("0,00%");
    expect(formatearVariacion(0.04, 1)).toBe("0,0%");
  });

  it("el redondeo que no llega a cero conserva el signo", () => {
    expect(formatearVariacion(0.005)).toBe("+0,01%");
    expect(formatearVariacion(-0.006)).toBe("−0,01%");
  });
});

describe("porcentajeEntero", () => {
  it("redondea al entero", () => {
    expect(porcentajeEntero(0.137)).toBe("14%");
    expect(porcentajeEntero(0)).toBe("0%");
  });

  it("no dice 0% de un ahorro que no es cero", () => {
    expect(porcentajeEntero(0.004)).toBe("menos de 1%");
  });
});

describe("fechaEnPalabras", () => {
  it("no corre la fecha un dia por la zona horaria", () => {
    // new Date("2026-09-07") en UTC-3 da el 6.
    expect(fechaEnPalabras("2026-09-07")).toBe("7 de septiembre");
    expect(fechaEnPalabras("2026-01-01")).toBe("1 de enero");
    expect(fechaEnPalabras("2026-12-31")).toBe("31 de diciembre");
  });

  it("sin fecha valida devuelve vacio en vez de romper la pagina", () => {
    for (const malo of [null, undefined, "", "2026", "2026-13-01", "2026-00-10", "hoy", "2026-09-xx"]) {
      expect(fechaEnPalabras(malo)).toBe("");
    }
  });
});

describe("mesEnPalabras", () => {
  it("toma el mes de cualquier fecha del mes", () => {
    expect(mesEnPalabras("2026-10-01")).toBe("octubre");
    expect(mesEnPalabras("2026-01-31")).toBe("enero");
    expect(mesEnPalabras("2026-12")).toBe("diciembre");
  });

  it("vacio si no hay mes valido", () => {
    for (const malo of [null, undefined, "", "2026", "2026-13-01", "2026-00-01"]) {
      expect(mesEnPalabras(malo)).toBe("");
    }
  });
});

describe("precioPorUnidad", () => {
  it("lleva gramos y centimetros cubicos a kilo y litro", () => {
    // La fruta aparecia como "$3" el gramo; $3,49 y $2,51 se veian iguales.
    expect(espacios(precioPorUnidad(3.49, "g").texto)).toBe("$ 3.490");
    expect(espacios(precioPorUnidad(2.51, "g").texto)).toBe("$ 2.510");
    expect(precioPorUnidad(3.49, "g").unidad).toBe("kg");
    expect(precioPorUnidad(1.2, "cc").unidad).toBe("L");
  });

  it("la unidad queda como esta: ya es el precio de un articulo", () => {
    expect(precioPorUnidad(1500, "unidad")).toEqual({ texto: formatearPesos(1500), unidad: "unidad" });
  });
});

describe("formatearTamano", () => {
  it("cambia de escala a partir de mil", () => {
    expect(formatearTamano(500, "g")).toBe("500 g");
    expect(formatearTamano(1000, "g")).toBe("1 kg");
    expect(formatearTamano(2250, "cc")).toBe("2,25 L");
    expect(formatearTamano(354, "cc")).toBe("354 ml");
    expect(formatearTamano(30, "unidad")).toBe("30 u");
  });

  it("no inventa un tamano cuando no hay dato", () => {
    for (const [cantidad, unidad] of [
      [null, "g"],
      [0, "g"],
      [-5, "cc"],
      [500, null],
      // "1 unidad" es lo que carga una cadena cuando no informa el peso.
      [1, "unidad"],
    ] as const) {
      expect(formatearTamano(cantidad, unidad)).toBeNull();
    }
  });
});

describe("tamanoQueFalta", () => {
  it("lo agrega cuando la descripcion vino cortada", () => {
    expect(tamanoQueFalta("PLAYADITO YERBA CON", 500, "g")).toBe("500 g");
  });

  it("no lo repite si ya esta, en cualquiera de las dos escalas", () => {
    expect(tamanoQueFalta("COCA COLA GASEOSA ZERO 2.25L", 2250, "cc")).toBeNull();
    expect(tamanoQueFalta("AGUA MINERAL 1,5 L", 1500, "cc")).toBeNull();
    expect(tamanoQueFalta("LECHE ENTERA 1000CC", 1000, "cc")).toBeNull();
    expect(tamanoQueFalta("AZUCAR 1KG", 1000, "g")).toBeNull();
  });

  it("un numero que contiene al tamano no cuenta como el tamano", () => {
    // "100" esta adentro de "1000" y "0.5" adentro de "10.5": ninguno es el envase.
    expect(tamanoQueFalta("YOGUR FIRME 1000 G", 100, "g")).toBe("100 g");
    expect(tamanoQueFalta("SUAVIZANTE 10.5", 500, "cc")).toBe("500 ml");
    // Despues de un punto es la parte decimal (o de miles) de otro numero.
    expect(tamanoQueFalta("SAL FINA 1.500", 500, "g")).toBe("500 g");
  });

  it("un envase chico no se confunde con un cero de la descripcion", () => {
    // 4 g en kilos redondea a "0", que aparece en "0%".
    expect(tamanoQueFalta("CHICLE BELDENT 0% AZUCAR", 4, "g")).toBe("4 g");
  });
});
