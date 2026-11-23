// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, Route, Routes, useLocation } from "react-router";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import ProveedorLista from "./ProveedorLista";
import BarraCelular from "./BarraCelular";
import { CLAVE_LISTA } from "../utils/lista";

/* La barra del celular (openspec mis-gastos-y-barra-nueva). */

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let contenedor: HTMLDivElement;
let raiz: Root;

function Ruta() {
  return <p data-testid="ruta">{useLocation().pathname}</p>;
}

beforeEach(() => {
  window.localStorage.clear();
  contenedor = document.createElement("div");
  document.body.appendChild(contenedor);
  raiz = createRoot(contenedor);
});

afterEach(() => {
  act(() => raiz.unmount());
  contenedor.remove();
});

function mostrar(ruta: string) {
  act(() => {
    raiz.render(
      <MemoryRouter initialEntries={[ruta]}>
        <ProveedorLista>
          <BarraCelular />
          <Routes>
            <Route path="*" element={<Ruta />} />
          </Routes>
        </ProveedorLista>
      </MemoryRouter>
    );
  });
}

const etiquetas = () =>
  [...contenedor.querySelectorAll('nav[aria-label="Secciones"] li')].map((li) => li.textContent?.replace(/\d+/g, "").trim());

describe("BarraCelular", () => {
  it("tiene Promos, Buscar, Mi compra, Mis gastos y Más, en ese orden", () => {
    mostrar("/");
    expect(etiquetas()).toEqual(["🔥Promos", "🔎Buscar", "🛒Mi compra", "💸Mis gastos", "☰Más"]);
  });

  it("Mi compra sigue mostrando cuántos productos tiene", () => {
    window.localStorage.setItem(CLAVE_LISTA, JSON.stringify([
      { id_producto: "1", nombre: "a", cantidad: 1 },
      { id_producto: "2", nombre: "b", cantidad: 1 },
    ]));
    mostrar("/");
    const miLista = [...contenedor.querySelectorAll("nav a")].find((a) => a.textContent?.includes("Mi compra"));
    expect(miLista?.textContent).toContain("2");
  });

  it("Más abre la hoja y Más barato navega y deja Más marcado", () => {
    mostrar("/");
    const mas = contenedor.querySelector<HTMLButtonElement>("button[aria-controls='hoja-mas']")!;
    act(() => mas.click());
    expect(mas.getAttribute("aria-expanded")).toBe("true");
    const barato = [...contenedor.querySelectorAll<HTMLAnchorElement>("#hoja-mas a")].find((a) => a.textContent?.includes("Más barato"))!;
    act(() => barato.click());
    expect(contenedor.querySelector("[data-testid=ruta]")?.textContent).toBe("/quien-gana");
    expect(contenedor.querySelector("#hoja-mas")).toBeNull();
    expect(mas.getAttribute("aria-current")).toBe("page");
  });

  it("la hoja tiene Más barato, Inflación y Cómo se calcula", () => {
    mostrar("/gastos");
    act(() => contenedor.querySelector<HTMLButtonElement>("button[aria-controls='hoja-mas']")!.click());
    const items = [...contenedor.querySelectorAll("#hoja-mas a")].map((a) => a.getAttribute("href"));
    expect(items).toEqual(["/quien-gana", "/inflacion", "/como-se-calcula"]);
  });

  it("en Mis gastos marca Mis gastos y no Más", () => {
    mostrar("/gastos");
    const gastos = [...contenedor.querySelectorAll("nav a")].find((a) => a.textContent?.includes("Mis gastos"))!;
    expect(gastos.className).toContain("text-marca");
    expect(contenedor.querySelector("button[aria-controls='hoja-mas']")?.getAttribute("aria-current")).toBeNull();
  });
});
