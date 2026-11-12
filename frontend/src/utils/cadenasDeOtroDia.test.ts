import { describe, expect, it } from "vitest";
import { etiquetaFechaPrecio, textoCadenasDeOtroDia } from "./cadenasDeOtroDia";
import { fechaCorta } from "./formato";

describe("fechaCorta", () => {
  it("dia y mes sin correrse por la zona horaria", () => {
    expect(fechaCorta("2026-11-10")).toBe("10/11");
    expect(fechaCorta("2026-01-01")).toBe("1/1");
  });

  it("sin fecha valida devuelve vacio", () => {
    for (const malo of [null, undefined, "", "2026-13-01", "2026-11-xx", "2026-11-00"]) {
      expect(fechaCorta(malo)).toBe("");
    }
  });
});

describe("textoCadenasDeOtroDia", () => {
  it("sin cadenas no hay aviso", () => {
    expect(textoCadenasDeOtroDia({ fecha_datos: "2026-11-11", cadenas: [] })).toBeNull();
    expect(textoCadenasDeOtroDia(null)).toBeNull();
  });

  it("una cadena", () => {
    expect(
      textoCadenasDeOtroDia({ fecha_datos: "2026-11-08", cadenas: [{ cadena: "Dia", fecha_precio: "2026-11-07" }] })
    ).toBe("SEPA no publicó los precios de Dia del 8/11: se muestran los del 7/11.");
  });

  it("tres cadenas del mismo dia, como Cencosud el 11-11", () => {
    const cadenas = ["Disco", "Jumbo", "Vea"].map((cadena) => ({ cadena, fecha_precio: "2026-11-10" }));
    expect(textoCadenasDeOtroDia({ fecha_datos: "2026-11-11", cadenas })).toBe(
      "SEPA no publicó los precios de Disco, Jumbo y Vea del 11/11: se muestran los del 10/11."
    );
  });

  it("dos fechas distintas nombran cada una", () => {
    const texto = textoCadenasDeOtroDia({
      fecha_datos: "2026-11-11",
      cadenas: [
        { cadena: "Dia", fecha_precio: "2026-11-09" },
        { cadena: "Jumbo", fecha_precio: "2026-11-10" },
      ],
    });
    expect(texto).toBe(
      "SEPA no publicó los precios de Dia y Jumbo del 11/11: se muestran los más recientes: Jumbo del 10/11 y Dia del 9/11."
    );
  });
});

describe("etiquetaFechaPrecio", () => {
  it("solo marca el precio que no es del dia", () => {
    expect(etiquetaFechaPrecio("2026-11-10", "2026-11-11")).toBe("precio del 10/11");
    expect(etiquetaFechaPrecio("2026-11-11", "2026-11-11")).toBeNull();
    // API anterior sin la columna: no se marca nada.
    expect(etiquetaFechaPrecio(undefined, "2026-11-11")).toBeNull();
  });
});
