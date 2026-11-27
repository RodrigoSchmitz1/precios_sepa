import { describe, expect, it } from "vitest";
import type { ResultadoLista, TotalCadenaLista } from "../types";
import { cifraDeLista, comparacionDeLista, productosComparados, vistaDeLista } from "./listaEnZona";

function fila(cadena: string, total: number, completa: boolean, faltan: string[] = []): TotalCadenaLista {
  return { cadena, total, productos_con_precio: completa ? 3 : 3 - faltan.length, completa, faltan };
}

const NACIONAL = [
  fila("Cooperativa Obrera", 8550, true),
  fila("Coto", 5000, false, ["alfajor"]),
  fila("Día", 5200, false, ["alfajor"]),
];

function resultado(zona?: ResultadoLista["zona"]): ResultadoLista {
  return {
    productos: [{ id_producto: "yerba" }, { id_producto: "aceite" }, { id_producto: "alfajor" }] as ResultadoLista["productos"],
    no_encontrados: [],
    cadenas: NACIONAL,
    combinando_cadenas: 7650,
    fecha_datos: "2026-11-16",
    ...(zona ? { zona } : {}),
  };
}

const LOMAS = new Set(["Coto", "Día", "Carrefour"]);
const ZONA_LOMAS: ResultadoLista["zona"] = {
  cadenas: [fila("Coto", 5000, true), fila("Día", 5200, true)],
  combinando_cadenas: 4800,
  no_en_zona: ["alfajor"],
  mas_barato: {},
};

describe("vistaDeLista", () => {
  it("sin zona compara todo el país, como antes", () => {
    const v = vistaDeLista(resultado(), null);
    expect(v.alcance).toBe("pais");
    expect(v.completas.map((c) => c.cadena)).toEqual(["Cooperativa Obrera"]);
    expect(v.combinando).toBe(7650);
    expect(v.otras).toEqual([]);
  });

  it("con zona, el titular sale solo de las cadenas de la zona", () => {
    const v = vistaDeLista(resultado(ZONA_LOMAS), LOMAS);
    expect(v.alcance).toBe("zona");
    expect(v.completas.map((c) => c.cadena)).toEqual(["Coto", "Día"]);
    expect(v.combinando).toBe(4800);
    expect(v.noEnZona).toEqual(["alfajor"]);
  });

  it("las cadenas sin sucursal en la zona van aparte", () => {
    const v = vistaDeLista(resultado(ZONA_LOMAS), LOMAS);
    expect(v.otras.map((c) => c.cadena)).toEqual(["Cooperativa Obrera"]);
  });

  it("si en la zona no se consigue nada, compara el país y lo dice", () => {
    const zona = { cadenas: [], combinando_cadenas: 0, no_en_zona: ["yerba", "aceite", "alfajor"], mas_barato: {} };
    const v = vistaDeLista(resultado(zona), LOMAS);
    expect(v.alcance).toBe("pais");
    expect(v.nadaEnZona).toBe(true);
    expect(v.completas.map((c) => c.cadena)).toEqual(["Cooperativa Obrera"]);
  });

  it("con zona elegida pero sin el bloque todavía (cotización vieja), compara el país", () => {
    expect(vistaDeLista(resultado(), LOMAS).alcance).toBe("pais");
  });

  it("los productos comparados en la zona no cuentan los que no se consiguen", () => {
    const r = resultado(ZONA_LOMAS);
    expect(productosComparados(r, vistaDeLista(r, LOMAS))).toBe(2);
    expect(productosComparados(r, vistaDeLista(r, null))).toBe(3);
  });
});

describe("comparacionDeLista", () => {
  it("Lomas: $ 13.088 contra $ 13.300 es casi lo mismo", () => {
    expect(comparacionDeLista(fila("Maxi (Carrefour)", 13088, true), fila("Coto", 13300, true))).toBe("casi_igual");
  });

  it("del 5% para arriba es ahorro", () => {
    expect(comparacionDeLista(fila("Día", 10000, true), fila("Coto", 10500, true))).toBe("ahorro");
    expect(comparacionDeLista(fila("Día", 10000, true), fila("Coto", 10499, true))).toBe("casi_igual");
  });

  it("una sola cadena o el mismo total no es una comparación", () => {
    const una = fila("La Anónima", 14750, true);
    expect(comparacionDeLista(una, una)).toBe("sin_comparacion");
    expect(comparacionDeLista(una, fila("Coto", 14750, true))).toBe("sin_comparacion");
    expect(comparacionDeLista(undefined, undefined)).toBe("sin_comparacion");
  });
});

describe("cifraDeLista (app-para-el-usuario)", () => {
  it("compara la más barata con la siguiente, no con la más cara", () => {
    const c = cifraDeLista([fila("Express", 58030, true), fila("Día", 54619, true), fila("Market", 56767, true)])!;
    expect(c.barata.cadena).toBe("Día");
    expect(c.siguiente?.cadena).toBe("Market");
    expect(c.diferencia).toBe(2148);
    expect(c.comparacion).toBe("casi_igual");
  });

  it("del 5% para arriba contra la siguiente es ahorro", () => {
    const c = cifraDeLista([fila("Día", 10000, true), fila("Coto", 10600, true), fila("Jumbo", 14000, true)])!;
    expect(c.comparacion).toBe("ahorro");
    expect(c.diferencia).toBe(600);
  });

  it("con una sola cadena completa no compara", () => {
    const c = cifraDeLista([fila("La Anónima", 14750, true)])!;
    expect(c.siguiente).toBeUndefined();
    expect(c.diferencia).toBe(0);
    expect(c.comparacion).toBe("sin_comparacion");
  });

  it("sin cadenas completas no hay cifra", () => {
    expect(cifraDeLista([])).toBeNull();
  });
});
