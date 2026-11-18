import { describe, expect, it } from "vitest";
import { leerCantidad, mostrarCantidad } from "./cantidad";

describe("mostrarCantidad", () => {
  it("con coma decimal y sin ceros de más", () => {
    expect(mostrarCantidad(20.86)).toBe("20,86");
    expect(mostrarCantidad(3.5)).toBe("3,5");
    expect(mostrarCantidad(4)).toBe("4");
    expect(mostrarCantidad(1.005)).toBe("1");
    expect(mostrarCantidad(0.6499999)).toBe("0,65");
  });
});

describe("leerCantidad", () => {
  it("acepta coma o punto", () => {
    expect(leerCantidad("3,5")).toBe(3.5);
    expect(leerCantidad("3.5")).toBe(3.5);
    expect(leerCantidad(" 12 ")).toBe(12);
    expect(leerCantidad(",5")).toBe(0.5);
    expect(leerCantidad("2,")).toBe(2);
  });

  it("rechaza lo que no es un número mayor que cero", () => {
    for (const texto of ["", "0", "0,0", "-2", "abc", "1,2,3", "1.000,5", "2kg"]) {
      expect(leerCantidad(texto)).toBeNull();
    }
  });
});
