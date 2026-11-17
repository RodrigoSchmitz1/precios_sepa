import { describe, expect, it } from "vitest";
import type { ResultadoLista, TotalCadenaLista } from "../types";
import { productosComparados, vistaDeLista } from "./listaEnZona";

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
