import { describe, expect, it } from "vitest";
import type { Gasto } from "../types";
import { porRubro, productosDelMes, productosDeRubro, RUBRO_OTROS } from "./resumenGastos";

/* Rubros y productos de Mis gastos (openspec app-para-el-usuario). */

const RUBROS = {
  "Yerba mate": "Infusiones y azúcares",
  Cafe: "Infusiones y azúcares",
  "Leche fluida": "Lácteos",
  Quesos: "Lácteos",
  Fideos: "Almacén",
  Arroz: "Almacén",
  Cerveza: "Bebidas",
  "Higiene personal": "Higiene",
  "Limpieza del hogar": "Limpieza",
  "Carne vacuna": "Carnes",
  "Alimento para mascotas": "Mascotas",
  Pan: "Panadería",
};

describe("porRubro", () => {
  it("suma las categorías en su rubro", () => {
    const filas = porRubro(
      [
        { nombre: "Yerba mate", total: 8000 },
        { nombre: "Leche fluida", total: 6000 },
        { nombre: "Cafe", total: 4000 },
        { nombre: "Quesos", total: 3000 },
      ],
      RUBROS,
    );
    expect(filas).toEqual([
      { nombre: "Infusiones y azúcares", total: 12000 },
      { nombre: "Lácteos", total: 9000 },
    ]);
  });

  it("muestra 7 rubros y junta el resto en Otros, con Sin detalle al final", () => {
    // Un total por rubro, de mayor a menor: Mascotas y Panadería quedan 8.° y 9.°.
    const porRubroOrden = ["Yerba mate", "Leche fluida", "Fideos", "Cerveza", "Higiene personal", "Limpieza del hogar", "Carne vacuna", "Alimento para mascotas", "Pan"];
    const categorias = porRubroOrden.map((nombre, i) => ({ nombre, total: 10000 - i * 500 }));
    const filas = porRubro([...categorias, { nombre: "Categoria rara", total: 100 }, { nombre: "Sin detalle", total: 20000 }], RUBROS);
    expect(filas.map((f) => f.nombre)).toEqual([
      "Infusiones y azúcares", "Lácteos", "Almacén", "Bebidas", "Higiene", "Limpieza", "Carnes", RUBRO_OTROS, "Sin detalle",
    ]);
    expect(filas.find((f) => f.nombre === RUBRO_OTROS)!.total).toBe(6500 + 6000 + 100);
  });

  it("sin mapa de rubros, las categorías como antes", () => {
    const filas = [{ nombre: "Yerba mate", total: 1 }];
    expect(porRubro(filas, {})).toBe(filas);
    expect(porRubro(filas, null)).toBe(filas);
  });
});

const linea = (id: string | null, descripcion: string, categoria: string, cantidad: number, importe: number) => ({
  descripcion, cantidad, precio_unitario: importe / cantidad, importe, codigo: id, id_producto: id, nombre: id ? descripcion : null,
  categoria, vinculo: id ? ("codigo" as const) : ("ninguno" as const),
});
const ticket = (id: string, cadena: string, lineas: ReturnType<typeof linea>[], descuentos = 0): Gasto => ({
  id, origen: "foto", cadena, cadenas_sepa: [cadena], sucursal: null, fecha: "2026-11-10", comprobante: null,
  total: lineas.reduce((s, l) => s + l.importe, 0) - descuentos, lineas,
  descuentos: descuentos ? [{ descripcion: "promo", importe: descuentos }] : [], creado: Number(id),
});

describe("productosDelMes", () => {
  it("la misma yerba en tres tickets es un solo producto, con ×3 y el total de los tres", () => {
    const yerba = () => linea("779", "Yerba Playadito 1 kg", "Yerba mate", 1, 5208);
    const productos = productosDelMes(
      [ticket("1", "Día", [yerba()]), ticket("2", "Día", [yerba()]), ticket("3", "Coto", [yerba(), linea("1", "Leche", "Leche fluida", 3, 4500)])],
      RUBROS,
    );
    expect(productos[0]).toMatchObject({ clave: "779", cantidad: 3, total: 15624, cadenas: ["Día", "Coto"], rubro: "Infusiones y azúcares" });
    expect(productos).toHaveLength(2);
  });

  it("reparte los descuentos del ticket y suma por descripción las líneas sin vincular", () => {
    const productos = productosDelMes(
      [ticket("1", "Día", [linea(null, "PAN FRANCES", "Pan", 1, 1000), linea(null, "pan frances ", "Pan", 1, 1000)], 200)],
      RUBROS,
    );
    expect(productos).toHaveLength(1);
    expect(productos[0].total).toBeCloseTo(1800);
  });

  it("Otros junta los productos de los rubros que no se ven", () => {
    const productos = productosDelMes(
      [ticket("1", "Día", [linea("1", "Alimento perro", "Alimento para mascotas", 1, 900), linea("2", "Leche", "Leche fluida", 1, 1500)])],
      RUBROS,
    );
    expect(productosDeRubro(productos, RUBRO_OTROS, ["Lácteos"]).map((p) => p.nombre)).toEqual(["Alimento perro"]);
    expect(productosDeRubro(productos, "Lácteos", ["Lácteos"]).map((p) => p.nombre)).toEqual(["Leche"]);
  });
});
