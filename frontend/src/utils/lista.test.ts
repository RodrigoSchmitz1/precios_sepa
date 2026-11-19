import { describe, expect, it } from "vitest";
import type { ItemLista } from "../types";
import { agregarALista, listaALink, listaDelLink, MAXIMO_PRODUCTOS, MAXIMO_UNIDADES, sumarListas } from "./lista";

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

describe("la lista en un link (openspec compartir-y-pegar-la-lista)", () => {
  it("ida y vuelta, sin escribir la cantidad 1", () => {
    const link = listaALink([item("7790387000014", 2), item("7790742192301")]);
    expect(link).toBe("7790387000014x2-7790742192301");
    expect(listaDelLink(link)).toEqual([
      { id_producto: "7790387000014", cantidad: 2 },
      { id_producto: "7790742192301", cantidad: 1 },
    ]);
  });

  it("descarta códigos inválidos y repetidos, y acota cantidades y productos", () => {
    expect(listaDelLink("<script>-12-7790387000014x0-7790387000014x5-abc")).toEqual([{ id_producto: "7790387000014", cantidad: 1 }]);
    expect(listaDelLink("7790387000014x99")).toEqual([{ id_producto: "7790387000014", cantidad: 99 }]);
    const muchos = Array.from({ length: 80 }, (_, i) => String(7790000000000 + i)).join("-");
    expect(listaDelLink(muchos)).toHaveLength(MAXIMO_PRODUCTOS);
    expect(listaDelLink(null)).toEqual([]);
  });

  it("sumar: los nuevos al final y en un repetido la cantidad mayor", () => {
    const r = sumarListas([item("1", 1), item("2", 5)], [item("2", 3), item("3", 2), item("1", 4)]);
    expect(r.map((i) => [i.id_producto, i.cantidad])).toEqual([
      ["1", 4],
      ["2", 5],
      ["3", 2],
    ]);
  });

  it("sumar respeta el tope de productos", () => {
    const llena = Array.from({ length: MAXIMO_PRODUCTOS }, (_, i) => item(String(i)));
    expect(sumarListas(llena, [item("nuevo")])).toHaveLength(MAXIMO_PRODUCTOS);
  });
});
