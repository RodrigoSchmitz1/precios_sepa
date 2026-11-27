// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { obtenerPromosBancarias } from "../api/client";
import { ContextoZona, type EstadoZona } from "../contexto/zona";
import { reiniciarPromosBancariasParaTests } from "../contexto/usePromosBancarias";
import type { PromoBancaria, TotalCadenaLista } from "../types";
import type { Zona } from "../utils/zona";
import ConQuePagar from "./ConQuePagar";
import PromosBancariasHoy from "./PromosBancariasHoy";

/* Promos bancarias en la portada y en Mi compra (openspec promos-bancarias). */

vi.mock("../api/client", () => ({ obtenerPromosBancarias: vi.fn() }));
// Hoy es jueves 26 de noviembre de 2026 para estos tests.
vi.mock("../utils/gastos", () => ({ hoyEnArgentina: () => "2026-11-26" }));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const PALERMO: Zona = { nombre: "Palermo", provincia: "AR-C", latitud: -34.58, longitud: -58.42, cadenas: ["Dia", "Coto"] };

const promo = (cambios: Partial<PromoBancaria>): PromoBancaria => ({
  id: "x", cadenas: ["Dia"], entidad: "MODO", medio: "qr", segmento: null, dias: ["jueves"], porcentaje: 20, tipo: "reintegro",
  canal: "ambos", tope: 10000, tope_periodo: "mes", compra_minima: null, rubros: null, acumula: "no_se_sabe",
  vigente_desde: "2026-11-01", vigente_hasta: "2026-11-30", fuente: "https://www.carrefour.com.ar/descuentos-bancarios", revisada: "2026-11-27",
  ...cambios,
});

const PROMOS = [
  promo({ id: "dia-modo" }),
  promo({ id: "coto-ciudad", cadenas: ["Coto"], entidad: "Banco Ciudad", porcentaje: 25, tipo: "descuento", tope: null, tope_periodo: null }),
  promo({ id: "jumbo-galicia", cadenas: ["Jumbo"], entidad: "Galicia", porcentaje: 30 }),
  promo({ id: "dia-nacion-viernes", entidad: "Banco Nación", porcentaje: 15, dias: ["viernes"] }),
];

function zona(z: Zona | null): EstadoZona {
  const nada = () => {};
  return { zona: z, zonas: [], lista: true, aviso: null, elegir: nada, usarUbicacion: nada, ubicando: false, errorUbicacion: null, cerrarAviso: nada };
}

let contenedor: HTMLDivElement;
let raiz: Root;

beforeEach(() => {
  window.localStorage.clear();
  reiniciarPromosBancariasParaTests();
  contenedor = document.createElement("div");
  document.body.appendChild(contenedor);
  raiz = createRoot(contenedor);
  vi.mocked(obtenerPromosBancarias).mockResolvedValue({ promos: PROMOS, revisadas_hasta: "2026-11-27" });
});

afterEach(() => {
  act(() => raiz.unmount());
  contenedor.remove();
  vi.clearAllMocks();
});

async function mostrar(nodo: React.ReactNode, z: Zona | null = PALERMO) {
  await act(async () => {
    raiz.render(
      <MemoryRouter>
        <ContextoZona.Provider value={zona(z)}>{nodo}</ContextoZona.Provider>
      </MemoryRouter>,
    );
  });
  return texto();
}
const texto = () => (contenedor.textContent ?? "").replace(/\s+/g, " ");
const boton = (t: string) => [...contenedor.querySelectorAll("button")].find((b) => b.textContent?.includes(t))!;

describe("Promos bancarias de hoy", () => {
  it("un jueves en Palermo: las de las cadenas de la zona, con su fuente", async () => {
    const t = await mostrar(<PromosBancariasHoy />);
    expect(t).toContain("Promos bancarias de hoy");
    expect(t).toContain("Banco Ciudad");
    expect(t).toContain("MODO");
    expect(t).not.toContain("Galicia");
    expect(t).toContain("Fuente: página de Carrefour · revisada el 27/11");
  });

  it("Mañana muestra las del viernes", async () => {
    await mostrar(<PromosBancariasHoy />);
    await act(async () => boton("Mañana").click());
    expect(texto()).toContain("Banco Nación");
    expect(texto()).not.toContain("Banco Ciudad");
  });

  it("con MODO marcado, solo las de MODO y la opción de ver todas", async () => {
    window.localStorage.setItem("changuito.tarjetas.v1", JSON.stringify({ entidades: ["MODO"], segmentos: [] }));
    const t = await mostrar(<PromosBancariasHoy />);
    expect(t).toContain("MODO");
    expect(t).not.toContain("Banco Ciudad");
    await act(async () => boton("Ver todas").click());
    expect(texto()).toContain("Banco Ciudad");
  });

  it("sin tarjetas marcadas invita a marcarlas, y marcar filtra", async () => {
    await mostrar(<PromosBancariasHoy />);
    await act(async () => boton("Marcá tus tarjetas").click());
    await act(async () => contenedor.querySelector<HTMLButtonElement>('[aria-label="Mis tarjetas"] button[aria-pressed="false"]')!.click());
    expect(JSON.parse(window.localStorage.getItem("changuito.tarjetas.v1")!).entidades).toHaveLength(1);
  });

  it("sin promos cargadas no muestra nada", async () => {
    vi.mocked(obtenerPromosBancarias).mockResolvedValue({ promos: [], revisadas_hasta: null });
    expect(await mostrar(<PromosBancariasHoy />)).toBe("");
  });
});

describe("Con qué pagar hoy", () => {
  const fila = (cadena: string, total: number): TotalCadenaLista => ({ cadena, total, productos_con_precio: 12, completa: true, faltan: [] });

  it("reintegro con tope y descuento en caja, en dos cifras", async () => {
    const t = await mostrar(<ConQuePagar completas={[fila("Día", 54619), fila("Coto", 57212)]} />);
    expect(t).toContain("Con MODO (20%): pagás $ 54.619 en caja y te devuelven $ 10.000 en 10 a 30 días.");
    expect(t).toContain("Llega al tope");
    expect(t).toContain("Con Banco Ciudad (25%): pagás $ 42.909 en caja.");
  });

  it("sin zona no se muestra", async () => {
    expect(await mostrar(<ConQuePagar completas={[fila("Día", 54619)]} />, null)).toBe("");
  });
});
