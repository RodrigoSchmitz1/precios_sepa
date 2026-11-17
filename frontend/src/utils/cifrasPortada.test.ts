import { describe, expect, it } from "vitest";
import type { CanastaPorCadena, InflacionResumen, QuienGana } from "../types";
import { cifrasDePortada } from "./cifrasPortada";

function gana(categoria: string, cadena: string, pct: number): QuienGana {
  return {
    categoria,
    rubro: "Almacén",
    cadena,
    productos_ganados: pct,
    productos_ofrecidos: 100,
    total_productos_categoria: 100,
    pct_gana_cuando_compite: pct,
    pct_victorias: pct,
  } as QuienGana;
}

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

const INFLACION = [{ categoria: "Huevos", variacion_pct: 6.3, mes: "2026-11" } as InflacionResumen];
const NACIONAL = [gana("Yerba", "Maxi (Carrefour)", 60), gana("Yerba", "Día", 40), gana("Aceite", "Maxi (Carrefour)", 70)];
const CANASTA_PAIS = canasta([["Maxi (Carrefour)", 88000], ["La Anónima", 100000]]);
const LOMAS = ["Carrefour", "Coto", "Dia", "Disco", "Express (Carrefour)", "Maxi (Carrefour)"];
const QG_LOMAS = [gana("Yerba", "Carrefour", 55), gana("Yerba", "Coto", 30), gana("Aceite", "Carrefour", 50), gana("Aceite", "Día", 50)];

describe("cifrasDePortada", () => {
  it("sin zona, como hasta ahora: Maxi y el ahorro del país", () => {
    const [lider, subio, ahorro] = cifrasDePortada({ inflacion: INFLACION, quienGana: NACIONAL, canasta: CANASTA_PAIS }, null);
    expect([lider.etiqueta, lider.valor, lider.detalle]).toEqual(["Más barata en más categorías", "Maxi (Carrefour)", "en 2 de 2 categorías"]);
    expect(subio.detalle).not.toContain("todo el país");
    expect([ahorro.etiqueta, ahorro.valor]).toEqual(["Cuánto ahorrás eligiendo dónde", "12%"]);
  });

  it("con zona, la más barata y el ahorro son de la zona", () => {
    const zona = canasta([["Carrefour", 90000], ["Coto", 99000]], "zona");
    const [lider, subio, ahorro] = cifrasDePortada({ inflacion: INFLACION, quienGana: QG_LOMAS, canasta: zona, canastaDeZona: true }, LOMAS);
    expect([lider.etiqueta, lider.valor]).toEqual(["Tu súper más barato cerca", "Carrefour"]);
    expect(lider.detalle).toContain("2 de 2 categorías");
    expect(subio.detalle).toContain("todo el país");
    expect([ahorro.etiqueta, ahorro.valor]).toEqual(["Cuánto ahorrás en tu zona", "9%"]);
    expect(ahorro.detalle).not.toContain("La Anónima");
  });

  it("zona sin canasta cotizable: el ahorro es del país y lo dice", () => {
    const cifras = cifrasDePortada({ inflacion: INFLACION, quienGana: QG_LOMAS, canasta: CANASTA_PAIS, canastaDeZona: false }, LOMAS);
    const ahorro = cifras[2];
    expect(ahorro.etiqueta).toBe("Cuánto ahorrás eligiendo dónde");
    expect(ahorro.detalle).toMatch(/todo el país$/);
  });

  it("zona con una sola cadena: lo dice, sin ranking ni ahorrás", () => {
    const zona = canasta([["La Anónima", 101000]], "zona");
    const cifras = cifrasDePortada({ inflacion: INFLACION, quienGana: [gana("Yerba", "La Anónima", 100)], canasta: zona, canastaDeZona: true }, ["La Anonima"]);
    expect(cifras.map((c) => c.etiqueta)).toEqual(["Tu única cadena cerca", "Lo que más subió", "La canasta básica en La Anónima"]);
    expect(cifras[0].valor).toBe("La Anónima");
    expect(cifras[2].valor).toMatch(/101\.000/);
    expect(cifras.some((c) => /ahorr/i.test(c.etiqueta))).toBe(false);
  });

  it("zona con una sola cadena y la canasta del país: el total de esa cadena, nunca el ahorro", () => {
    const cifras = cifrasDePortada({ inflacion: INFLACION, canasta: CANASTA_PAIS, canastaDeZona: false }, ["La Anonima"]);
    expect(cifras.map((c) => c.etiqueta)).toEqual(["Tu única cadena cerca", "Lo que más subió", "La canasta básica en La Anónima"]);
    expect(cifras[2].detalle).toContain("precios de la cadena en todo el país");
  });

  it("zona con una sola cadena que no está en la canasta: sin tarjeta de canasta", () => {
    const cifras = cifrasDePortada({ inflacion: INFLACION, canasta: CANASTA_PAIS, canastaDeZona: false }, ["Cooperativa Obrera"]);
    expect(cifras.map((c) => c.etiqueta)).toEqual(["Tu única cadena cerca", "Lo que más subió"]);
  });

  it("con zona y quién gana todavía sin llegar, no muestra la cadena del país", () => {
    const cifras = cifrasDePortada({ inflacion: INFLACION, canasta: undefined }, LOMAS);
    expect(cifras.map((c) => c.etiqueta)).toEqual(["Lo que más subió"]);
  });
});
