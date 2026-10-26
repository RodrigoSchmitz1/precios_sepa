/*
  liderEn decide el titular de Mas barato y la tarjeta de la portada.

  Ademas de los casos a mano, se compara contra un oraculo: una cuenta escrita
  aparte, lo mas literal posible, sobre tablas generadas con semilla fija. Si
  alguien optimiza liderEn y cambia la regla sin querer, el oraculo no cambia
  con el y el test lo marca.
*/
import { describe, expect, it } from "vitest";
import type { QuienGana } from "../types";
import { liderEn } from "./liderazgo";

function fila(categoria: string, cadena: string, pct: number): QuienGana {
  return {
    categoria,
    cadena,
    pct_gana_cuando_compite: pct,
  } as QuienGana;
}

describe("liderEn", () => {
  it("cuenta en cuantas categorias cada cadena tiene el mejor porcentaje", () => {
    const filas = [
      fila("Yerba", "Coto", 60),
      fila("Yerba", "Dia", 40),
      fila("Arroz", "Dia", 70),
      fila("Arroz", "Coto", 30),
      fila("Fideos", "Dia", 55),
      fila("Fideos", "Coto", 45),
    ];
    expect(liderEn(filas, ["Yerba", "Arroz", "Fideos"])).toEqual(["Dia", 2]);
  });

  it("un empate en el tope cuenta para las dos cadenas", () => {
    const filas = [fila("Yerba", "Coto", 50), fila("Yerba", "Dia", 50), fila("Arroz", "Coto", 80)];
    expect(liderEn(filas, ["Yerba", "Arroz"])).toEqual(["Coto", 2]);
    expect(liderEn(filas, ["Yerba"])?.[1]).toBe(1);
  });

  it("no depende del orden en que llegan las filas", () => {
    const filas = [fila("Yerba", "Dia", 40), fila("Yerba", "Coto", 60), fila("Arroz", "Coto", 10), fila("Arroz", "Dia", 90)];
    const invertidas = [...filas].reverse();
    expect(liderEn(filas, ["Yerba", "Arroz"])?.[1]).toBe(liderEn(invertidas, ["Yerba", "Arroz"])?.[1]);
  });

  it("ignora categorias sin filas y devuelve undefined si no hay nada", () => {
    expect(liderEn([], ["Yerba"])).toBeUndefined();
    expect(liderEn([fila("Yerba", "Coto", 60)], ["Yerba", "Inexistente"])).toEqual(["Coto", 1]);
  });

  it("coincide con un oraculo independiente en 200 tablas al azar", () => {
    const azar = generador(20261026);
    const cadenas = ["Coto", "Dia", "Carrefour", "Jumbo", "Vea", "Maxi"];
    for (let caso = 0; caso < 200; caso++) {
      const categorias = Array.from({ length: 1 + Math.floor(azar() * 12) }, (_, i) => `Cat${i}`);
      const filas: QuienGana[] = [];
      for (const categoria of categorias) {
        for (const cadena of cadenas) {
          // Porcentajes enteros y pocos valores: fuerza empates, que es donde falla.
          if (azar() < 0.7) filas.push(fila(categoria, cadena, Math.floor(azar() * 5) * 10));
        }
      }
      const obtenido = liderEn(filas, categorias);
      const esperado = oraculo(filas, categorias);
      if (esperado.maximo === 0) {
        expect(obtenido).toBeUndefined();
        continue;
      }
      expect(obtenido?.[1]).toBe(esperado.maximo);
      expect(esperado.lideres).toContain(obtenido?.[0]);
    }
  });
});

/** La regla escrita de nuevo, sin compartir nada con liderEn. */
function oraculo(filas: QuienGana[], categorias: string[]) {
  const cuenta: Record<string, number> = {};
  for (const categoria of categorias) {
    let tope = -Infinity;
    for (const f of filas) if (f.categoria === categoria && f.pct_gana_cuando_compite > tope) tope = f.pct_gana_cuando_compite;
    for (const f of filas) if (f.categoria === categoria && f.pct_gana_cuando_compite === tope) cuenta[f.cadena] = (cuenta[f.cadena] ?? 0) + 1;
  }
  const maximo = Math.max(0, ...Object.values(cuenta));
  return { maximo, lideres: Object.keys(cuenta).filter((c) => cuenta[c] === maximo) };
}

/** Pseudoaleatorio con semilla (mulberry32): una falla se reproduce igual. */
function generador(semilla: number) {
  let estado = semilla >>> 0;
  return () => {
    estado = (estado + 0x6d2b79f5) >>> 0;
    let t = estado;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
