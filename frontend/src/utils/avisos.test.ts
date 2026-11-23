// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { alternarAviso, leerAvisos, MAXIMO_AVISOS, sacarAviso } from "./avisos";

/* "Avisame cuando este de oferta" (openspec promos-navegables-y-mes-en-gastos). */

const producto = (n: number) => ({ id_producto: String(7790000000000 + n), descripcion: `PRODUCTO ${n}` });

beforeEach(() => window.localStorage.clear());
afterEach(() => vi.restoreAllMocks());

describe("avisos", () => {
  it("agrega y saca con el mismo botón", () => {
    expect(alternarAviso(producto(1), "2026-11-23")).toBe("agregado");
    expect(leerAvisos()).toEqual([{ ...producto(1), desde: "2026-11-23" }]);
    expect(alternarAviso(producto(1), "2026-11-24")).toBe("sacado");
    expect(leerAvisos()).toEqual([]);
  });

  it("siguen ahí en otra visita", () => {
    alternarAviso(producto(1), "2026-11-23");
    alternarAviso(producto(2), "2026-11-23");
    // Otra visita: lo unico que queda es lo guardado en el navegador.
    const guardado = JSON.parse(window.localStorage.getItem("changuito.avisos.v1")!);
    expect(guardado.map((a: { id_producto: string }) => a.id_producto)).toEqual([producto(1).id_producto, producto(2).id_producto]);
  });

  it("tope de avisos", () => {
    for (let n = 0; n < MAXIMO_AVISOS; n++) expect(alternarAviso(producto(n), "2026-11-23")).toBe("agregado");
    expect(alternarAviso(producto(999), "2026-11-23")).toBe("tope");
    expect(leerAvisos()).toHaveLength(MAXIMO_AVISOS);
    // Sacar uno sigue andando con el tope lleno.
    expect(sacarAviso(producto(0).id_producto)).toBe(true);
    expect(alternarAviso(producto(999), "2026-11-23")).toBe("agregado");
  });

  it("si el navegador no deja guardar, lo dice y no rompe", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("QuotaExceededError");
    });
    expect(alternarAviso(producto(1), "2026-11-23")).toBe("sin-guardar");
    expect(leerAvisos()).toEqual([]);
  });

  it("ignora lo que no es un aviso", () => {
    window.localStorage.setItem("changuito.avisos.v1", JSON.stringify([{ id_producto: "" }, { nada: 1 }, { ...producto(3), desde: "x" }]));
    expect(leerAvisos().map((a) => a.id_producto)).toEqual([producto(3).id_producto]);
    window.localStorage.setItem("changuito.avisos.v1", "{roto");
    expect(() => leerAvisos()).not.toThrow();
  });
});
