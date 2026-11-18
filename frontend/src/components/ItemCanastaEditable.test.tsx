// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ItemCanastaIA } from "../types";
import ItemCanastaEditable from "./ItemCanastaEditable";

/* El control de cantidades de Tu canasta (openspec tu-canasta-confiable). */

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const ARROZ: ItemCanastaIA = { categoria: "Arroz", cantidad: 3710, unidad: "g", gama: "economico", razon: "" };

let contenedor: HTMLDivElement;
let raiz: Root;
const onCambiarCantidad = vi.fn();

beforeEach(() => {
  contenedor = document.createElement("div");
  document.body.appendChild(contenedor);
  raiz = createRoot(contenedor);
});

afterEach(() => {
  act(() => raiz.unmount());
  contenedor.remove();
  vi.clearAllMocks();
});

async function mostrar(item = ARROZ) {
  await act(async () => {
    raiz.render(<ItemCanastaEditable item={item} onCambiarCantidad={onCambiarCantidad} onCambiarGama={() => {}} onQuitar={() => {}} />);
  });
  return contenedor.querySelector("input")!;
}

/** Tipear en un campo controlado de React desde jsdom. */
async function tipear(campo: HTMLInputElement, texto: string) {
  const asignar = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
  await act(async () => {
    campo.focus();
  });
  await act(async () => {
    asignar.call(campo, texto);
    campo.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await act(async () => {
    campo.blur();
  });
}

describe("ItemCanastaEditable", () => {
  it("muestra la cantidad con coma decimal", async () => {
    const campo = await mostrar();
    expect(campo.value).toBe("3,71");
    expect(campo.getAttribute("inputmode")).toBe("decimal");
  });

  it("acepta coma o punto, al salir del campo", async () => {
    await tipear(await mostrar(), "3,5");
    expect(onCambiarCantidad).toHaveBeenLastCalledWith("Arroz", 3500);
    await tipear(await mostrar(), "2.25");
    expect(onCambiarCantidad).toHaveBeenLastCalledWith("Arroz", 2250);
  });

  it("lo que no es un número no cambia nada y vuelve a la cantidad", async () => {
    const campo = await mostrar();
    await tipear(campo, "abc");
    expect(onCambiarCantidad).not.toHaveBeenCalled();
    expect(campo.value).toBe("3,71");
  });

  it("+ y − cambian de a 100 g", async () => {
    await mostrar();
    await act(async () => {
      (contenedor.querySelector('button[aria-label="Aumentar cantidad"]') as HTMLButtonElement).click();
    });
    expect(onCambiarCantidad).toHaveBeenLastCalledWith("Arroz", 3810);
    await act(async () => {
      (contenedor.querySelector('button[aria-label="Reducir cantidad"]') as HTMLButtonElement).click();
    });
    expect(onCambiarCantidad).toHaveBeenLastCalledWith("Arroz", 3610);
  });
});
