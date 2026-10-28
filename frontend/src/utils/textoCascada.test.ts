import { describe, expect, it } from "vitest";
import type { IncidenciaCanasta } from "../types";
import { textosCascada } from "./textoCascada";

function datos(cambios: Partial<IncidenciaCanasta> = {}): IncidenciaCanasta {
  return {
    mes: "2026-10-01",
    fecha_inicio: "2026-09-30",
    fecha_fin: "2026-10-27",
    desde_inicio_de_mes: true,
    variacion_canasta_pct: 0.95,
    cobertura_pct: 100,
    categorias: [
      { categoria: "Carne vacuna", peso_pct: 60, variacion_pct: 1.3, incidencia_pp: 0.78, cadenas: 7 },
      { categoria: "Fideos", peso_pct: 40, variacion_pct: 0.42, incidencia_pp: 0.17, cadenas: 9 },
    ],
    sin_indice: [],
    sin_precio: [],
    ...cambios,
  };
}

describe("textosCascada", () => {
  it("con toda la canasta medida habla de la canasta", () => {
    const t = textosCascada(datos(), true);
    expect(t.titulo).toBe("La canasta básica subió 0,95%");
    expect(t.etiquetaTotal).toBe("Canasta básica");
    expect(t.aviso).toBeNull();
  });

  it("con cobertura parcial el titular dice que son las categorias medidas", () => {
    const t = textosCascada(datos({ cobertura_pct: 58.1, sin_indice: ["Verduras", "Frutas"] }), true);
    expect(t.titulo).toBe("Las 2 categorías medidas de la canasta básica subieron 0,95%");
    expect(t.etiquetaTotal).toBe("Lo medido");
    expect(t.aviso).toMatch(/^Son el 58,1% del gasto de la canasta\. Sin índice este mes: /);
  });

  it("baja en plural y en singular", () => {
    expect(textosCascada(datos({ cobertura_pct: 80, variacion_canasta_pct: -1.2 }), true).titulo).toBe(
      "Las 2 categorías medidas de la canasta básica bajaron 1,20%"
    );
    const una = datos({ cobertura_pct: 50, categorias: [datos().categorias[0]] });
    expect(textosCascada(una, true).titulo).toBe("La única categoría medida de la canasta básica subió 0,95%");
  });

  it("no dice 'en lo que va del mes' si el periodo arranca a mitad de mes", () => {
    const t = textosCascada(datos({ desde_inicio_de_mes: false, fecha_inicio: "2026-09-15" }), true);
    expect(t.periodo).toMatch(/^ desde el 15 de septiembre/);
    expect(textosCascada(datos(), true).periodo).toBe(" en lo que va del mes");
    expect(textosCascada(datos(), false).periodo).toBe("");
  });

  it("separa las categorias sin precio y aclara sobre que gasto es la cobertura", () => {
    const t = textosCascada(datos({ cobertura_pct: 100, sin_precio: ["Hielo"] }), true);
    expect(t.titulo).toMatch(/^Las 2 categorías medidas/);
    expect(t.aviso).toBe("Son el 100% del gasto de las categorías con precio. Sin precio para pesarlas: Hielo.");
  });
});
