import { describe, expect, it, vi } from "vitest";
import type { ProductoDetalle } from "../types";
import { codigosAProbar, codigoValido, resolverCodigo } from "./codigoDeBarras";

/* El escáner de códigos de barras (openspec app-para-el-usuario). */

const YERBA = { id_producto: "7790387000014", descripcion: "YERBA PLAYADITO 1KG" } as ProductoDetalle;

describe("codigoDeBarras", () => {
  it("valida solo dígitos con largo de código de producto", () => {
    expect(codigoValido(" 7790387 000014 ")).toBe("7790387000014");
    expect(codigoValido("123")).toBeNull();
  });

  it("prueba el código, con un 0 adelante y sin los ceros de adelante", () => {
    expect(codigosAProbar("07790387000014")).toEqual(["07790387000014", "7790387000014"]);
    expect(codigosAProbar("790387000014")).toEqual(["790387000014", "0790387000014"]);
  });

  it("un código conocido devuelve el producto", async () => {
    const obtener = vi.fn(async (id: string) => {
      if (id === YERBA.id_producto) return YERBA;
      throw new Error("no");
    });
    expect(await resolverCodigo("7790387000014", obtener)).toBe(YERBA);
  });

  it("con un 0 de más (como informa Coto) lo encuentra igual", async () => {
    const obtener = vi.fn(async (id: string) => {
      if (id === YERBA.id_producto) return YERBA;
      throw new Error("no");
    });
    expect(await resolverCodigo("07790387000014", obtener)).toBe(YERBA);
  });

  it("un código que no está devuelve null", async () => {
    expect(await resolverCodigo("7790000000000", async () => Promise.reject(new Error("no")))).toBeNull();
  });
});
