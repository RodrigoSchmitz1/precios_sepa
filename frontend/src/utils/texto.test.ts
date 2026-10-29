// @vitest-environment jsdom
/*
  Texto y nombres: busqueda sin tildes, descripciones legibles, nombres de
  cadenas y la lista guardada en el navegador.
*/
import { afterEach, describe, expect, it } from "vitest";
import { guardarLista, leerLista, MAXIMO_PRODUCTOS, MAXIMO_UNIDADES } from "./lista";
import { conNombresDeCadena, nombreCategoria } from "./nombres";
import { listarConY, nombreLegible, normalizar } from "./texto";

afterEach(() => window.localStorage.clear());

describe("listarConY", () => {
  it("une con comas y una y final", () => {
    expect(listarConY([])).toBe("");
    expect(listarConY(["Coto"])).toBe("Coto");
    expect(listarConY(["Coto", "Dia"])).toBe("Coto y Dia");
    expect(listarConY(["Coto", "Dia", "Vea"])).toBe("Coto, Dia y Vea");
  });
});

describe("normalizar", () => {
  it("busca igual con o sin tildes y enies", () => {
    expect(normalizar("San Martín")).toBe(normalizar("san martin"));
    expect(normalizar("PAÑALES")).toBe("panales");
    expect(normalizar("Güemes")).toBe("guemes");
  });
});

describe("nombreLegible", () => {
  it("pasa a minuscula y le devuelve la mayuscula a la marca", () => {
    expect(nombreLegible("YERBA MATE PLAYADITO 1 KG", "PLAYADITO")).toBe("Yerba mate Playadito 1 kg");
  });

  it("agrega la marca si la descripcion no la dice", () => {
    expect(nombreLegible("PAN ARABE CLASICO", "DELIP")).toBe("Pan arabe clasico · Delip");
  });

  it("no la duplica si ya aparece una palabra de la marca", () => {
    expect(nombreLegible("LECHE SERENISIMA 1L", "LA SERENISIMA")).toBe("Leche Serenisima 1l");
  });

  it("no agrega lo que las cadenas cargan cuando no hay marca", () => {
    for (const marca of ["SIN MARCA", "s/m", "Generico", "VARIOS", null, ""]) {
      expect(nombreLegible("TOMATE PERITA", marca)).toBe("Tomate perita");
    }
  });

  it("aguanta marcas con caracteres de expresiones regulares", () => {
    expect(nombreLegible("CHOCOLATE M&M'S 45G", "M&M'S")).toBe("Chocolate M&m's 45g");
    expect(() => nombreLegible("SHAMPOO (X2) [OFERTA]", "L OREAL+")).not.toThrow();
  });
});

describe("nombres de cadenas", () => {
  it("cambia solo el campo cadena, a cualquier profundidad", () => {
    const datos = { cadena: "Dia", filas: [{ cadena: "Changomas", categoria: "Panales" }], otro: "Dia" };
    expect(conNombresDeCadena(datos)).toEqual({
      cadena: "Día",
      filas: [{ cadena: "Changomás", categoria: "Panales" }],
      otro: "Dia",
    });
  });

  it("la categoria se traduce solo para mostrar", () => {
    expect(nombreCategoria("Panales")).toBe("Pañales");
    expect(nombreCategoria("Categoria nueva")).toBe("Categoria nueva");
  });
});

describe("Tu lista", () => {
  const item = (i: number, cantidad = 1) => ({ id_producto: String(i), nombre: `Producto ${i}`, cantidad });

  it("ida y vuelta", () => {
    guardarLista([item(1, 3)]);
    expect(leerLista()).toEqual([item(1, 3)]);
  });

  it("acota cantidades y largo aunque el storage diga otra cosa", () => {
    window.localStorage.setItem(
      "changuito.lista.v1",
      JSON.stringify([item(1, 0), item(2, 500), ...Array.from({ length: 80 }, (_, i) => item(i + 3))])
    );
    const lista = leerLista();
    expect(lista).toHaveLength(MAXIMO_PRODUCTOS);
    expect(lista[0].cantidad).toBe(1);
    expect(lista[1].cantidad).toBe(MAXIMO_UNIDADES);
  });

  it("descarta lo que no tiene forma de item", () => {
    window.localStorage.setItem("changuito.lista.v1", JSON.stringify([item(1), { id_producto: 2 }, null, "x", item(3, 1.5)]));
    expect(leerLista()).toEqual([item(1)]);
  });
});
