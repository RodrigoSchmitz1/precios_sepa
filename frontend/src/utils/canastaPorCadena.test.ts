import { describe, expect, it } from "vitest";
import { encabezadoComparacion, lineaCategoriasAfuera } from "./canastaPorCadena";

describe("encabezadoComparacion", () => {
  it("dice sobre cuántas categorías compara", () => {
    expect(encabezadoComparacion(25, 32)).toBe("En las 25 categorías que venden todas,");
    expect(encabezadoComparacion(1, 3)).toBe("En la única categoría que venden todas,");
    expect(encabezadoComparacion(32, 32)).toBe("Con toda tu canasta,");
  });
});

describe("lineaCategoriasAfuera", () => {
  it("la canasta del INDEC en Lomas: frescas primero, hasta 4", () => {
    const afuera = ["Azucar", "Papa y tuberculos", "Verduras", "Frutas", "Pollo", "Pescado", "Huevos"];
    expect(lineaCategoriasAfuera(afuera)).toBe(
      "Verduras, frutas, pollo, huevos y 3 más no entran acá porque no las venden todas las cadenas. " +
        "Abajo, en Dónde comprarla cerca tuyo, sí se suman, sucursal por sucursal.",
    );
  });

  it("pocas, todas nombradas con y", () => {
    expect(lineaCategoriasAfuera(["Azucar", "Huevos"])).toMatch(/^Huevos y azúcar no entran acá/);
  });

  it("una sola, en singular", () => {
    expect(lineaCategoriasAfuera(["Pescado"])).toMatch(/^Pescado no entra acá porque no la venden todas/);
  });

  it("sin categorías afuera, nada", () => {
    expect(lineaCategoriasAfuera([])).toBe("");
  });
});
