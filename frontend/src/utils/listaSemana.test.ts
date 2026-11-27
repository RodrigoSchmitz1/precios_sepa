import { describe, expect, it } from "vitest";
import { cambioDeLaSemana, huellaDeLista, lunesDe, registrarSemana, type RegistroSemana } from "./listaSemana";

/* Tu lista esta semana (openspec app-para-el-usuario). */

const LISTA = [
  { id_producto: "1", nombre: "Yerba", cantidad: 1 },
  { id_producto: "2", nombre: "Leche", cantidad: 3 },
];
const HUELLA = huellaDeLista(LISTA, ["Dia", "Coto"]);
const PASADA: RegistroSemana = { semana: "2026-11-16", huella: HUELLA, cadena: "Día", total: 54619, anterior: null };

describe("lunesDe", () => {
  it("el viernes 27 de noviembre de 2026 es de la semana del lunes 23", () => {
    expect(lunesDe("2026-11-27")).toBe("2026-11-23");
    expect(lunesDe("2026-11-23")).toBe("2026-11-23");
    expect(lunesDe("2026-11-29")).toBe("2026-11-23");
  });
});

describe("huellaDeLista", () => {
  it("no depende del orden y sí de las cantidades", () => {
    expect(huellaDeLista([...LISTA].reverse(), ["Coto", "Dia"])).toBe(HUELLA);
    expect(huellaDeLista([{ ...LISTA[0], cantidad: 2 }, LISTA[1]], ["Dia", "Coto"])).not.toBe(HUELLA);
  });
});

describe("cambio de la semana", () => {
  const hoy = { semana: "2026-11-23", huella: HUELLA, cadena: "Día", total: 53900 };

  it("misma lista y cadena: dice cuánto bajó desde la semana pasada", () => {
    expect(cambioDeLaSemana(PASADA, hoy)).toBe(-719);
  });

  it("sigue diciéndolo durante la semana, después de guardar", () => {
    const guardado = registrarSemana(PASADA, hoy);
    expect(guardado.anterior).toBe(54619);
    expect(cambioDeLaSemana(guardado, { ...hoy, total: 53950 })).toBe(-669);
  });

  it("con la lista cambiada no compara", () => {
    const otra = { ...hoy, huella: huellaDeLista([...LISTA, { id_producto: "3", nombre: "Café", cantidad: 1 }], ["Dia", "Coto"]) };
    expect(cambioDeLaSemana(PASADA, otra)).toBeNull();
    expect(registrarSemana(PASADA, otra).anterior).toBeNull();
  });

  it("si cambió la cadena más barata no compara", () => {
    expect(cambioDeLaSemana(PASADA, { ...hoy, cadena: "Coto" })).toBeNull();
  });

  it("la primera semana no tiene con qué comparar", () => {
    expect(cambioDeLaSemana(null, hoy)).toBeNull();
    expect(registrarSemana(null, hoy).anterior).toBeNull();
  });
});
