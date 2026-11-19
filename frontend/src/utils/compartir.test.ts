import { describe, expect, it, vi } from "vitest";
import { compartir, textoDeLista, textoEnUnaLinea, textoParaCompartir } from "./compartir";

const DATOS = {
  titulo: "Yerba · Changuito",
  texto: "En Palermo conviene en Día",
  url: "https://x.test/mismo-producto?p=1&zona=AR-C%3APalermo",
};

function navegador(share?: () => Promise<void>, escribir: () => Promise<void> = () => Promise.resolve()) {
  return { share, clipboard: { writeText: vi.fn(escribir) } } as unknown as Navigator;
}

describe("compartir", () => {
  it("usa el menú nativo con el titular y el link", async () => {
    const share = vi.fn(() => Promise.resolve());
    const nav = navegador(share);
    expect(await compartir(DATOS, nav)).toBe("compartido");
    expect(share).toHaveBeenCalledWith({ title: DATOS.titulo, text: DATOS.texto, url: DATOS.url });
    expect(nav.clipboard.writeText).not.toHaveBeenCalled();
  });

  it("cerrar el menú no es un error ni copia nada", async () => {
    const nav = navegador(() => Promise.reject(new DOMException("cancelado", "AbortError")));
    expect(await compartir(DATOS, nav)).toBe("cancelado");
    expect(nav.clipboard.writeText).not.toHaveBeenCalled();
  });

  it("sin menú nativo copia el link", async () => {
    const nav = navegador(undefined);
    expect(await compartir(DATOS, nav)).toBe("copiado");
    expect(nav.clipboard.writeText).toHaveBeenCalledWith(DATOS.url);
  });

  it("si el menú falla por otra razón, copia", async () => {
    const nav = navegador(() => Promise.reject(new DOMException("no", "NotAllowedError")));
    expect(await compartir(DATOS, nav)).toBe("copiado");
  });

  it("si tampoco se puede copiar, avisa la falla", async () => {
    const nav = navegador(undefined, () => Promise.reject(new Error("sin permiso")));
    expect(await compartir(DATOS, nav)).toBe("fallo");
  });
});

describe("textoEnUnaLinea", () => {
  it("junta los espacios y saltos", () => {
    expect(textoEnUnaLinea("  En Palermo\n  conviene   en Día ")).toBe("En Palermo conviene en Día");
    expect(textoEnUnaLinea(null)).toBe("");
  });
});

describe("textoParaCompartir", () => {
  it("el producto y el titular, con la zona de quien comparte", () => {
    expect(textoParaCompartir("Yerba Playadito 500 g", "En tu zona cuesta casi lo mismo: de $ 2.789 en Disco", "Palermo, CABA")).toBe(
      "Yerba Playadito 500 g: En Palermo, CABA cuesta casi lo mismo: de $ 2.789 en Disco",
    );
    expect(textoParaCompartir("Yerba", "Conviene en Día: $ 2.490, 9% menos que en tu zona", "Palermo, CABA")).toBe(
      "Yerba: Conviene en Día: $ 2.490, 9% menos que en Palermo, CABA",
    );
  });

  it("sin zona, el titular tal cual; sin titular, el nombre", () => {
    expect(textoParaCompartir("Yerba", "Más barata en Vea", null)).toBe("Yerba: Más barata en Vea");
    expect(textoParaCompartir("Yerba", "  ", "Palermo, CABA")).toBe("Yerba");
  });
});

describe("compartir la lista (openspec compartir-y-pegar-la-lista)", () => {
  const pesos = (v: number) => `$ ${v.toLocaleString("es-AR")}`;

  it("sin menú nativo copia el texto y el link juntos", async () => {
    const nav = navegador(undefined);
    expect(await compartir(DATOS, nav, { copiarTexto: true })).toBe("copiado");
    expect(nav.clipboard.writeText).toHaveBeenCalledWith(`${DATOS.texto}\n${DATOS.url}`);
  });

  it("el texto dice los productos, las cantidades y dónde sale menos en la zona", () => {
    const texto = textoDeLista(
      [
        { nombre: "Yerba Playadito suave 1 kg", cantidad: 2 },
        { nombre: "Aceite Natura girasol 1,5 L", cantidad: 1 },
      ],
      { cadena: "Día", total: 24300 },
      "Lomas de Zamora, Buenos Aires",
      pesos,
    );
    expect(texto.split("\n")).toEqual([
      "Mi lista del súper · 2 productos",
      "En Lomas de Zamora, Buenos Aires, en Día sale $ 24.300",
      "• 2 × Yerba Playadito suave 1 kg",
      "• 1 × Aceite Natura girasol 1,5 L",
      "Armala y comparala en tu zona:",
    ]);
  });

  it("sin una cadena con todo, no hay línea de precio", () => {
    const texto = textoDeLista([{ nombre: "Yerba", cantidad: 1 }], null, null, pesos);
    expect(texto).toBe("Mi lista del súper · 1 producto\n• 1 × Yerba\nArmala y comparala en tu zona:");
  });
});
