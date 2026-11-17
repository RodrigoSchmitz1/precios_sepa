import { describe, expect, it } from "vitest";
import type { ItemLista } from "../types";
import { agregarALista, MAXIMO_PRODUCTOS, MAXIMO_UNIDADES } from "./lista";

const item = (id: string, cantidad = 1): ItemLista => ({ id_producto: id, nombre: `Producto ${id}`, cantidad });

describe("agregarALista", () => {
  it("agrega al final", () => {
    expect(agregarALista([item("a")], item("b")).map((i) => i.id_producto)).toEqual(["a", "b"]);
  });

  it("no repite un producto y devuelve la misma lista", () => {
    const lista = [item("a")];
    expect(agregarALista(lista, item("a", 3))).toBe(lista);
  });

  it(`no pasa de ${MAXIMO_PRODUCTOS} productos`, () => {
    const llena = Array.from({ length: MAXIMO_PRODUCTOS }, (_, i) => item(String(i)));
    expect(agregarALista(llena, item("otro"))).toBe(llena);
  });

  it("acota la cantidad entre 1 y el máximo", () => {
    expect(agregarALista([], item("a", 0))[0].cantidad).toBe(1);
    expect(agregarALista([], item("a", 500))[0].cantidad).toBe(MAXIMO_UNIDADES);
  });
});
