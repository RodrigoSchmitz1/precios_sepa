import { describe, expect, it } from "vitest";
import type { PrecioEnCadena, ProductoDetalle } from "../types";
import { DIFERENCIA_CASI_IGUAL_PCT, titularDelProducto } from "./titularProducto";

function precio(cadena: string, precio_mediano: number, precio_creible = true): PrecioEnCadena {
  return { cadena, precio_mediano, precio_minimo: precio_mediano, precio_maximo: precio_mediano, sucursales: 10, precio_creible };
}

function producto(precios: PrecioEnCadena[], extras: Partial<ProductoDetalle> = {}): ProductoDetalle {
  const creibles = precios.filter((p) => p.precio_creible).map((p) => p.precio_mediano);
  const bajo = Math.min(...creibles);
  const alto = Math.max(...creibles);
  return {
    id_producto: "7793704000928",
    descripcion: "PLAYADITO YERBA MATE SUAVE 1KG",
    marca: "PLAYADITO",
    categoria: "Yerba mate",
    cadenas: precios.length,
    empresas: precios.length,
    precio_mas_bajo: bajo,
    precio_mas_alto: alto,
    diferencia_pct: Math.round(((alto - bajo) / bajo) * 1000) / 10,
    extremos_respaldados: true,
    cadenas_descartadas: 0,
    fecha_datos: "2026-11-16",
    precios,
    ...extras,
  } as ProductoDetalle;
}

// La Playadito del explore: Vea la mas barata del pais, Coto la mas cara.
const PLAYADITO = producto([precio("Vea", 4890), precio("Carrefour", 5195), precio("Día", 5208), precio("Coto", 5250)]);
const LOMAS = new Set(["Carrefour", "Coto", "Día", "Disco", "Express (Carrefour)", "Maxi (Carrefour)"]);

describe("titularDelProducto", () => {
  it("con zona, los extremos son de la zona: Vea no aparece", () => {
    const t = titularDelProducto(PLAYADITO, LOMAS);
    expect(t.alcance).toBe("zona");
    expect(t.cifras.baratas).toEqual(["Carrefour"]);
    expect(t.cifras.caras).toEqual(["Coto"]);
    expect(t.cifras.cadenas).toBe(3);
  });

  it("con zona y 1% de diferencia, cuesta casi lo mismo", () => {
    expect(titularDelProducto(PLAYADITO, LOMAS).tipo).toBe("casi_igual");
  });

  it("sin zona, los extremos son los del país que publica la API", () => {
    const t = titularDelProducto(PLAYADITO, null);
    expect(t.alcance).toBe("pais");
    expect(t.tipo).toBe("diferencia"); // 7,4%
    expect(t.cifras.baratas).toEqual(["Vea"]);
  });

  it("la diferencia chica del explore: $5.079 contra $5.250 es casi lo mismo", () => {
    const t = titularDelProducto(producto([precio("SuperChangomás", 5079), precio("Coto", 5250)]), null);
    expect(t.tipo).toBe("casi_igual");
    expect(t.cifras.precioCaro - t.cifras.precio).toBe(171);
  });

  it(`el umbral es ${DIFERENCIA_CASI_IGUAL_PCT}%: justo en el límite ya es diferencia`, () => {
    expect(titularDelProducto(producto([precio("Día", 1000), precio("Coto", 1050)]), null).tipo).toBe("diferencia");
    expect(titularDelProducto(producto([precio("Día", 1000), precio("Coto", 1049)]), null).tipo).toBe("casi_igual");
  });

  it("Palermo del spec: Día un 20% menos que Express", () => {
    const p = producto([precio("Maxi (Carrefour)", 4500), precio("Día", 4775), precio("Coto", 5200), precio("Express (Carrefour)", 6000)]);
    const t = titularDelProducto(p, new Set(["Día", "Coto", "Express (Carrefour)"]));
    expect(t.tipo).toBe("diferencia");
    expect([t.cifras.baratas, t.cifras.caras, t.cifras.menosPct]).toEqual([["Día"], ["Express (Carrefour)"], 20]);
  });

  it("ninguna cadena de la zona lo vende: lo dice y las cifras son del país", () => {
    const t = titularDelProducto(PLAYADITO, new Set(["La Anónima"]));
    expect(t.tipo).toBe("no_en_zona");
    expect(t.cifras.baratas).toEqual(["Vea"]);
  });

  it("en la zona solo hay precios no creíbles", () => {
    const p = producto([precio("Vea", 4890), precio("Coto", 1200, false), precio("Día", 5208)]);
    expect(titularDelProducto(p, new Set(["Coto"])).tipo).toBe("sin_creible_en_zona");
  });

  it("una sola cadena en la zona", () => {
    const t = titularDelProducto(PLAYADITO, new Set(["Coto", "La Anónima"]));
    expect(t).toMatchObject({ tipo: "una_cadena", cadena: "Coto", precio: 5250 });
  });

  it("todas iguales en la zona", () => {
    const p = producto([precio("Día", 1000), precio("Coto", 1000), precio("Vea", 900)]);
    expect(titularDelProducto(p, new Set(["Día", "Coto"])).tipo).toBe("igual");
  });

  it("sin zona y extremos sin respaldo, como hoy", () => {
    const p = producto([precio("Día", 1000), precio("Coto", 2000)], { extremos_respaldados: false });
    expect(titularDelProducto(p, null).tipo).toBe("sin_respaldo");
  });
});
