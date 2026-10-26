// @vitest-environment jsdom
/*
  La canasta compartida por URL la puede escribir cualquiera, y la de
  localStorage puede ser de una version vieja. Los tests prueban la ida y
  vuelta y, sobre todo, que lo roto o malicioso se descarte entero.
*/
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  canastaAUrl,
  canastaDesdeUrl,
  guardarEnNavegador,
  leerDelNavegador,
  PARAMETRO_URL,
  type CanastaGuardada,
} from "./canastaGuardada";

const BASE = "https://ejemplo.test/canasta-personalizada";

const canasta: CanastaGuardada = {
  descripcion: "Familia de 4 en Ñuñoa, sin carne de cerdo 🥩",
  items: [
    { categoria: "Yerba", cantidad: 2000, unidad: "g", gama: "medio", razon: "" },
    { categoria: "Panales", cantidad: 30, unidad: "unidad", gama: "premium", razon: "" },
  ],
  localidades: [{ localidad: "San Martín", provincia: "Buenos Aires" }],
  fueraDelSuper: ["carniceria"],
};

const busqueda = (url: string) => new URL(url).search;
// Codificador propio del test, para no validar el modulo con su propia funcion.
const base64url = (texto: string) =>
  btoa(String.fromCharCode(...new TextEncoder().encode(texto))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const codificar = (datos: unknown) => "?" + PARAMETRO_URL + "=" + base64url(JSON.stringify(datos));

afterEach(() => {
  window.localStorage.clear();
  vi.restoreAllMocks();
});

describe("URL compartible", () => {
  it("ida y vuelta identica, con acentos, enies y emoji", () => {
    expect(canastaDesdeUrl(busqueda(canastaAUrl(canasta, BASE)))).toEqual(canasta);
  });

  it("la URL no lleva caracteres que haya que escapar", () => {
    const codigo = new URL(canastaAUrl(canasta, BASE)).searchParams.get(PARAMETRO_URL)!;
    expect(codigo).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it("un link viejo sin lugares de compra sigue abriendo", () => {
    const viejo = codificar({ v: 1, d: "x", i: [["Arroz", 1000, "g", "economico"]], l: [] });
    expect(canastaDesdeUrl(viejo)?.fueraDelSuper).toEqual([]);
  });

  it("recorta a tres zonas, lo que acepta el backend", () => {
    const zonas = Array.from({ length: 5 }, (_, i) => [`Loc${i}`, "Cordoba"]);
    const url = codificar({ v: 1, d: "", i: [["Arroz", 1000, "g", "economico"]], l: zonas });
    expect(canastaDesdeUrl(url)?.localidades).toHaveLength(3);
  });

  it("ignora lugares de compra desconocidos y repetidos", () => {
    const url = codificar({ v: 1, d: "", i: [["Arroz", 1000, "g", "economico"]], l: [], f: ["verduleria", "verduleria", "farmacia", 7] });
    expect(canastaDesdeUrl(url)?.fueraDelSuper).toEqual(["verduleria"]);
  });

  it.each([
    ["sin parametro", ""],
    ["base64 roto", `?${PARAMETRO_URL}=%%%`],
    ["no es JSON", `?${PARAMETRO_URL}=${base64url("hola")}`],
    ["version desconocida", codificar({ v: 2, d: "", i: [], l: [] })],
    ["items no es lista", codificar({ v: 1, d: "", i: "Arroz", l: [] })],
    ["gama inventada", codificar({ v: 1, d: "", i: [["Arroz", 1000, "g", "lujo"]], l: [] })],
    ["cantidad cero", codificar({ v: 1, d: "", i: [["Arroz", 0, "g", "medio"]], l: [] })],
    ["cantidad negativa", codificar({ v: 1, d: "", i: [["Arroz", -3, "g", "medio"]], l: [] })],
    ["cantidad no numerica", codificar({ v: 1, d: "", i: [["Arroz", "mucho", "g", "medio"]], l: [] })],
    ["categoria vacia", codificar({ v: 1, d: "", i: [["  ", 1000, "g", "medio"]], l: [] })],
    ["localidad vacia", codificar({ v: 1, d: "", i: [["Arroz", 1000, "g", "medio"]], l: [["", "Salta"]] })],
    ["prototipo envenenado", codificar({ v: 1, d: "", i: [{ __proto__: { categoria: "Arroz" } }], l: [] })],
  ])("descarta todo ante %s", (_, url) => {
    expect(canastaDesdeUrl(url)).toBeNull();
  });

  it("un item roto invalida la canasta entera, no solo ese item", () => {
    const url = codificar({ v: 1, d: "", i: [["Arroz", 1000, "g", "medio"], ["Yerba", 1000, "g", "lujo"]], l: [] });
    expect(canastaDesdeUrl(url)).toBeNull();
  });
});

describe("localStorage", () => {
  it("guarda y lee la misma canasta", () => {
    guardarEnNavegador(canasta);
    expect(leerDelNavegador()).toEqual(canasta);
  });

  it("un JSON corrupto se lee como canasta vacia", () => {
    window.localStorage.setItem("precios_sepa.canasta.v1", "{no es json");
    expect(leerDelNavegador()).toBeNull();
  });

  it("si el storage tira excepcion (incognito, lleno) la pagina sigue", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("QuotaExceededError");
    });
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new DOMException("SecurityError");
    });
    expect(() => guardarEnNavegador(canasta)).not.toThrow();
    expect(leerDelNavegador()).toBeNull();
  });
});
