import { describe, expect, it } from "vitest";
import type { CanastaPorCadena } from "../types";
import { cifrasDePortada } from "./cifrasPortada";

function canasta(totales: [string, number][], ambito: "zona" | "pais" = "pais"): CanastaPorCadena {
  return {
    ambito,
    cadenas: totales.map(([cadena, total]) => ({ cadena, total, con_otra_gama: 0, sucursales: 5 })),
    categorias_comparadas: Array.from({ length: 25 }, (_, i) => `c${i}`),
    categorias_afuera: [],
    cadenas_afuera: [],
    total_categorias: 32,
    fecha_datos: "2026-11-16",
  };
}

const CANASTA_PAIS = canasta([["Maxi (Carrefour)", 88000], ["La Anónima", 100000]]);
const LOMAS = ["Carrefour", "Coto", "Dia", "Disco", "Express (Carrefour)", "Maxi (Carrefour)"];

describe("cifrasDePortada", () => {
  it("sin zona o con dos cadenas o más no hay cifras: la portada tiene la de tu compra (app-para-el-usuario)", () => {
    expect(cifrasDePortada({ canasta: CANASTA_PAIS }, null)).toEqual([]);
    expect(cifrasDePortada({ canasta: canasta([["Carrefour", 90000], ["Coto", 99000]], "zona"), canastaDeZona: true }, LOMAS)).toEqual([]);
  });

  it("zona con una sola cadena: lo dice, sin ranking ni ahorrás", () => {
    const zona = canasta([["La Anónima", 101000]], "zona");
    const cifras = cifrasDePortada({ canasta: zona, canastaDeZona: true }, ["La Anonima"]);
    expect(cifras.map((c) => c.etiqueta)).toEqual(["Tu única cadena cerca", "La canasta básica en La Anónima"]);
    expect(cifras[0].valor).toBe("La Anónima");
    expect(cifras[1].valor).toMatch(/101\.000/);
    expect(cifras.some((c) => /ahorr/i.test(c.etiqueta))).toBe(false);
  });

  it("zona con una sola cadena y la canasta del país: el total de esa cadena, nunca el ahorro", () => {
    const cifras = cifrasDePortada({ canasta: CANASTA_PAIS, canastaDeZona: false }, ["La Anonima"]);
    expect(cifras.map((c) => c.etiqueta)).toEqual(["Tu única cadena cerca", "La canasta básica en La Anónima"]);
    expect(cifras[1].detalle).toContain("precios de la cadena en todo el país");
  });

  it("Rafaela: a cuánto está la otra cadena y lo que cuesta no tener opciones", () => {
    // cadenas-cerca-de-tu-zona: con una sola cadena la API cotiza el país, que trae a la más barata.
    const pais = canasta([["Maxi (Carrefour)", 142056], ["Día", 153613], ["La Anónima", 161836]]);
    const cifras = cifrasDePortada({ canasta: pais, canastaDeZona: false }, ["La Anonima"], {
      cadena: "Cooperativa Obrera",
      km: 35,
    });
    expect(cifras[0].detalle).toBe("La otra cadena más cercana, Cooperativa Obrera, está a unos 35 km");
    expect(cifras[1].detalle).toMatch(/En Maxi \(Carrefour\), la más barata del país, sale 12% menos$/);
    expect(cifras.some((c) => /ahorr/i.test(c.etiqueta + c.detalle))).toBe(false);
  });

  it("sin dato de la otra cadena, lo dice sin inventar distancia", () => {
    const cifras = cifrasDePortada({ canasta: CANASTA_PAIS, canastaDeZona: false }, ["La Anonima"], null);
    expect(cifras[0].detalle).toBe("SEPA no informa otra cadena cerca de tu zona");
  });

  it("si la única cadena es la más barata del país, no hay costo que decir", () => {
    const pais = canasta([["Maxi (Carrefour)", 142056], ["La Anónima", 161836]]);
    const cifras = cifrasDePortada({ canasta: pais, canastaDeZona: false }, ["Maxi (Carrefour)"]);
    expect(cifras[1].detalle).not.toMatch(/más barata del país/);
  });

  it("zona con una sola cadena que no está en la canasta: sin tarjeta de canasta", () => {
    const cifras = cifrasDePortada({ canasta: CANASTA_PAIS, canastaDeZona: false }, ["Cooperativa Obrera"]);
    expect(cifras.map((c) => c.etiqueta)).toEqual(["Tu única cadena cerca"]);
  });

});
