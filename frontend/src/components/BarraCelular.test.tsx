// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, Route, Routes, useLocation } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { obtenerEstadoSenales } from "../api/client";
import { reiniciarSenalesParaTests } from "../utils/senales";
import ProveedorLista from "./ProveedorLista";
import BarraCelular from "./BarraCelular";
import { CLAVE_LISTA } from "../utils/lista";

/* La barra del celular (openspec mis-gastos-y-barra-nueva). */

vi.mock("../api/client", () => ({
  obtenerEstadoSenales: vi.fn(() => Promise.resolve({ activas: false })),
  enviarSenales: vi.fn(),
}));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let contenedor: HTMLDivElement;
let raiz: Root;

function Ruta() {
  return <p data-testid="ruta">{useLocation().pathname}</p>;
}

beforeEach(() => {
  window.localStorage.clear();
  reiniciarSenalesParaTests();
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

  it("la hoja tiene Más barato, Inflación, Cómo se calcula y Privacidad", () => {
    mostrar("/gastos");
    act(() => contenedor.querySelector<HTMLButtonElement>("button[aria-controls='hoja-mas']")!.click());
    const items = [...contenedor.querySelectorAll("#hoja-mas a")].map((a) => a.getAttribute("href"));
    expect(items).toEqual(["/quien-gana", "/inflacion", "/como-se-calcula", "/privacidad"]);
  });

  it("en Mis gastos marca Mis gastos y no Más", () => {
    mostrar("/gastos");
    const gastos = [...contenedor.querySelectorAll("nav a")].find((a) => a.textContent?.includes("Mis gastos"))!;
    expect(gastos.className).toContain("text-marca");
    expect(contenedor.querySelector("button[aria-controls='hoja-mas']")?.getAttribute("aria-current")).toBeNull();
  });
});

describe("datos anónimos en el menú Más (senales-anonimas)", () => {
  it("con el servicio apagado no aparece el interruptor", async () => {
    mostrar("/");
    await act(async () => contenedor.querySelector<HTMLButtonElement>('[aria-controls="hoja-mas"]')!.click());
    expect(contenedor.querySelector('[role="switch"]')).toBeNull();
  });

  it("con el servicio activo se apaga en un toque", async () => {
    vi.mocked(obtenerEstadoSenales).mockResolvedValue({ activas: true });
    mostrar("/");
    await act(async () => contenedor.querySelector<HTMLButtonElement>('[aria-controls="hoja-mas"]')!.click());
    const interruptor = contenedor.querySelector('[role="switch"]') as HTMLButtonElement;
    expect(interruptor.getAttribute("aria-checked")).toBe("true");
    await act(async () => interruptor.click());
    expect(interruptor.getAttribute("aria-checked")).toBe("false");
    expect(JSON.parse(window.localStorage.getItem("changuito.senales.v1")!).apagadas).toBe(true);
  });
});
