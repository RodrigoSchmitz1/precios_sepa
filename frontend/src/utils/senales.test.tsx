// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { enviarSenales, obtenerEstadoSenales } from "../api/client";
import {
  apagarSenales,
  idDelDia,
  MAXIMO_POR_TANDA,
  reiniciarSenalesParaTests,
  senal,
  vaciarCola,
} from "./senales";
import { AvisoDatosAnonimos, HojaDatosAnonimos, InterruptorDatosAnonimos } from "../components/DatosAnonimos";

/* Señales anonimas (openspec senales-anonimas). */

vi.mock("../api/client", () => ({
  obtenerEstadoSenales: vi.fn(),
  enviarSenales: vi.fn(),
}));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const ZONA = { provincia: "AR-C", nombre: "Caballito" };
const esperar = () => act(async () => {});

beforeEach(() => {
  window.localStorage.clear();
  reiniciarSenalesParaTests();
  vi.mocked(obtenerEstadoSenales).mockResolvedValue({ activas: true });
});

afterEach(() => {
  vi.clearAllMocks();
  vi.useRealTimers();
});

describe("la cola de señales", () => {
  it("prendidas por defecto: manda la tanda con el identificador del día y la zona", async () => {
    senal({ tipo: "vista_rubro", rubro: "limpieza" }, ZONA);
    await esperar();
    vaciarCola();
    expect(enviarSenales).toHaveBeenCalledTimes(1);
    const cuerpo = vi.mocked(enviarSenales).mock.calls[0][0] as { id: string; zona: unknown; eventos: unknown[] };
    expect(cuerpo.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(cuerpo.zona).toEqual(ZONA);
    expect(cuerpo.eventos).toEqual([{ tipo: "vista_rubro", rubro: "limpieza" }]);
  });

  it("con el servicio apagado no manda nada", async () => {
    vi.mocked(obtenerEstadoSenales).mockResolvedValue({ activas: false });
    senal({ tipo: "vista_rubro", rubro: "limpieza" }, ZONA);
    await esperar();
    vaciarCola();
    expect(enviarSenales).not.toHaveBeenCalled();
  });

  it("apagadas: no encola y descarta lo pendiente", async () => {
    senal({ tipo: "vista_rubro", rubro: "limpieza" }, ZONA);
    apagarSenales();
    senal({ tipo: "busqueda", texto: "yerba" }, ZONA);
    await esperar();
    vaciarCola();
    expect(enviarSenales).not.toHaveBeenCalled();
  });

  it("manda en tandas de a lo sumo el máximo", async () => {
    for (let i = 0; i < MAXIMO_POR_TANDA + 5; i++) senal({ tipo: "vista_rubro", rubro: "limpieza" }, ZONA);
    await esperar();
    vaciarCola();
    const tamanos = vi.mocked(enviarSenales).mock.calls.map((c) => (c[0] as { eventos: unknown[] }).eventos.length);
    expect(tamanos).toEqual([MAXIMO_POR_TANDA, 5]);
  });

  it("si cambia la zona, manda lo anterior con su zona", async () => {
    senal({ tipo: "vista_rubro", rubro: "limpieza" }, ZONA);
    await esperar();
    senal({ tipo: "vista_rubro", rubro: "almacen" }, { provincia: "AR-B", nombre: "Lomas" });
    await esperar();
    vaciarCola();
    const zonas = vi.mocked(enviarSenales).mock.calls.map((c) => (c[0] as { zona: { nombre: string } }).zona.nombre);
    expect(zonas).toEqual(["Caballito", "Lomas"]);
  });

  it("otro día, otro identificador", () => {
    const lunes = idDelDia("2026-11-23");
    expect(idDelDia("2026-11-23")).toBe(lunes);
    expect(idDelDia("2026-11-24")).not.toBe(lunes);
  });

  it("sin almacenamiento no rompe", async () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("QuotaExceededError");
    });
    expect(() => senal({ tipo: "vista_rubro", rubro: "limpieza" }, ZONA)).not.toThrow();
    await esperar();
    expect(() => vaciarCola()).not.toThrow();
    vi.restoreAllMocks();
  });
});

describe("el aviso, la hoja y el interruptor", () => {
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
  });

  async function mostrar() {
    await act(async () => {
      raiz.render(
        <>
          <AvisoDatosAnonimos />
          <HojaDatosAnonimos />
          <InterruptorDatosAnonimos />
        </>,
      );
    });
  }

  const boton = (t: string) => [...contenedor.querySelectorAll("button")].find((b) => b.textContent?.includes(t));

  it("con el servicio apagado no aparece nada", async () => {
    vi.mocked(obtenerEstadoSenales).mockResolvedValue({ activas: false });
    await mostrar();
    expect(contenedor.textContent).toBe("");
  });

  it("Entendido esconde el aviso para siempre", async () => {
    await mostrar();
    expect(contenedor.textContent).toContain("cuenta de forma anónima");
    await act(async () => boton("Entendido")!.click());
    expect(contenedor.textContent).not.toContain("cuenta de forma anónima");
    expect(JSON.parse(window.localStorage.getItem("changuito.senales.v1")!).avisoVisto).toBe(true);
  });

  it("Más info abre la hoja con qué se cuenta y qué no", async () => {
    await mostrar();
    await act(async () => boton("Más info")!.click());
    const hoja = contenedor.querySelector('[role="dialog"]')!;
    expect(hoja.textContent).toContain("Qué no:");
    expect(hoja.textContent).toContain("cambia cada día");
    await act(async () => boton("Listo")!.click());
    expect(contenedor.querySelector('[role="dialog"]')).toBeNull();
  });

  it("el interruptor apaga en un toque y deja de mandar", async () => {
    await mostrar();
    const interruptor = contenedor.querySelector('[role="switch"]') as HTMLButtonElement;
    expect(interruptor.getAttribute("aria-checked")).toBe("true");
    await act(async () => interruptor.click());
    expect(interruptor.getAttribute("aria-checked")).toBe("false");
    senal({ tipo: "vista_rubro", rubro: "limpieza" }, ZONA);
    await esperar();
    vaciarCola();
    expect(enviarSenales).not.toHaveBeenCalled();
  });
});
