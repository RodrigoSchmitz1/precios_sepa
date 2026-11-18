// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import BotonCompartir from "./BotonCompartir";

/* El boton Compartir del detalle (openspec compartir-por-whatsapp). */

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const DATOS = { titulo: "Yerba · Changuito", texto: "En Palermo conviene en Día", url: "https://x.test/mismo-producto?p=1" };

let contenedor: HTMLDivElement;
let raiz: Root;

beforeEach(() => {
  contenedor = document.createElement("div");
  document.body.appendChild(contenedor);
  raiz = createRoot(contenedor);
});

afterEach(() => {
  act(() => raiz.unmount());
  contenedor.remove();
  vi.unstubAllGlobals();
});

function ponerNavegador(share: unknown, writeText: () => Promise<void>) {
  vi.stubGlobal("navigator", { share, clipboard: { writeText: vi.fn(writeText) } });
}

async function tocar() {
  await act(async () => {
    raiz.render(<BotonCompartir datos={() => DATOS} />);
  });
  await act(async () => {
    contenedor.querySelector("button")!.click();
  });
  return contenedor.textContent ?? "";
}

describe("BotonCompartir", () => {
  it("abre el menú nativo con el titular y el link", async () => {
    const share = vi.fn(() => Promise.resolve());
    ponerNavegador(share, () => Promise.resolve());
    const texto = await tocar();
    expect(share).toHaveBeenCalledWith({ title: DATOS.titulo, text: DATOS.texto, url: DATOS.url });
    expect(texto).toBe("Compartir");
  });

  it("sin menú nativo copia el link y lo dice", async () => {
    ponerNavegador(undefined, () => Promise.resolve());
    expect(await tocar()).toContain("Link copiado");
  });

  it("cancelar no muestra nada", async () => {
    ponerNavegador(() => Promise.reject(new DOMException("x", "AbortError")), () => Promise.resolve());
    expect(await tocar()).toBe("Compartir");
  });

  it("si no se puede copiar, muestra el link para copiarlo a mano", async () => {
    ponerNavegador(undefined, () => Promise.reject(new Error("no")));
    expect(await tocar()).toContain("Copiá este link: https://x.test/mismo-producto?p=1");
  });
});
