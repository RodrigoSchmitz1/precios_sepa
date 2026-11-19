import { describe, expect, it } from "vitest";
import type { OpcionCompra } from "../types";
import { categoriasQueFaltan, comparableConUnaSola, mejorOpcion } from "./opcionesCompra";

function opcion(max_sucursales: number, total: number, categorias: string[]): OpcionCompra {
  return {
    max_sucursales,
    total,
    items_cubiertos: categorias.length,
    distancia_suma_km: 1,
    sucursales: [
      {
        id: `s${max_sucursales}`,
        cadena: "Día",
        nombre_sucursal: "Día 1",
        direccion: null,
        localidad: "Lomas",
        provincia: "AR-B",
        latitud: 0,
        longitud: 0,
        distancia_km: 1,
        equivalentes: 0,
        subtotal: total,
        items: categorias.map((categoria) => ({ categoria, gama: "economico", unidad: "g", cantidad: 1, precio_unitario: 1, costo: 1 })),
      },
    ],
  };
}

const TODAS = ["Pan", "Arroz", "Pescado"];
// El caso del explore: una sucursal más barata pero sin una categoría.
const UNA = opcion(1, 144427, ["Pan", "Arroz"]);
const DOS = opcion(2, 146661, TODAS);
const TRES = opcion(3, 145000, TODAS);

describe("mejorOpcion", () => {
  it("primero la cobertura, después el costo", () => {
    expect(mejorOpcion([UNA, DOS])).toBe(DOS);
    expect(mejorOpcion([UNA, DOS, TRES])).toBe(TRES);
  });

  it("a igual cobertura, la más barata", () => {
    const unaCompleta = opcion(1, 150000, TODAS);
    expect(mejorOpcion([unaCompleta, DOS])).toBe(DOS);
  });

  it("sin opciones, nada", () => {
    expect(mejorOpcion([])).toBeNull();
  });
});

describe("comparableConUnaSola", () => {
  it("solo si cubren lo mismo", () => {
    expect(comparableConUnaSola(DOS, UNA)).toBe(false);
    expect(comparableConUnaSola(DOS, opcion(1, 150000, TODAS))).toBe(true);
    expect(comparableConUnaSola(UNA, UNA)).toBe(false);
  });
});

describe("categoriasQueFaltan", () => {
  it("las que tienen precio en la zona y la opción no cubre", () => {
    expect(categoriasQueFaltan(UNA, TODAS)).toEqual(["Pescado"]);
    expect(categoriasQueFaltan(DOS, TODAS)).toEqual([]);
  });
});
