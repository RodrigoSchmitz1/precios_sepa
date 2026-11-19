// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { optimizarCompra } from "../api/client";
import { ContextoZona, type EstadoZona } from "../contexto/zona";
import type { ItemCanastaIA } from "../types";
import type { Zona } from "../utils/zona";
import DondeComprarla from "./DondeComprarla";

/* El paso 4 de Tu canasta arranca en la zona (openspec tu-canasta-confiable). */

vi.mock("../api/client", () => ({ optimizarCompra: vi.fn() }));
// Leaflet no anda en jsdom; el mapa solo recibe el punto y lo prueba el E2E.
const puntosDelMapa: unknown[] = [];
vi.mock("./MapaZona", () => ({
  default: ({ punto }: { punto: unknown }) => {
    puntosDelMapa.push(punto);
    return null;
  },
}));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const LOMAS: Zona = { nombre: "Lomas de Zamora", provincia: "AR-B", latitud: -34.76, longitud: -58.4, cadenas: ["Coto", "Dia"] };
const ROSARIO: Zona = { nombre: "Rosario", provincia: "AR-S", latitud: -32.95, longitud: -60.65, cadenas: ["Coto"] };
const ITEMS: ItemCanastaIA[] = [{ categoria: "Arroz", cantidad: 1000, unidad: "g", gama: "economico", razon: "" }];

function estadoZona(zona: Zona | null): EstadoZona {
  const nada = () => {};
  return { zona, zonas: [], lista: true, aviso: null, elegir: nada, usarUbicacion: nada, ubicando: false, errorUbicacion: null, cerrarAviso: nada };
}

let contenedor: HTMLDivElement;
let raiz: Root;

beforeEach(() => {
  contenedor = document.createElement("div");
  document.body.appendChild(contenedor);
  raiz = createRoot(contenedor);
  puntosDelMapa.length = 0;
  vi.mocked(optimizarCompra).mockResolvedValue({ opciones: [], items_sin_precio: [], sucursales_en_zona: 0, radio_km: 2 } as never);
});

afterEach(() => {
  act(() => raiz.unmount());
  contenedor.remove();
  vi.clearAllMocks();
});

async function mostrar(zona: Zona | null) {
  await act(async () => {
    raiz.render(
      <ContextoZona.Provider value={estadoZona(zona)}>
        <DondeComprarla items={ITEMS} />
      </ContextoZona.Provider>,
    );
  });
}

describe("DondeComprarla", () => {
  it("con zona calcula desde su centro sin tocar el mapa", async () => {
    await mostrar(LOMAS);
    expect(optimizarCompra).toHaveBeenCalledWith(ITEMS, -34.76, -58.4, 3);
    expect(puntosDelMapa.at(-1)).toEqual({ latitud: -34.76, longitud: -58.4 });
  });

  it("al cambiar la zona pasa a la nueva", async () => {
    await mostrar(LOMAS);
    await mostrar(ROSARIO);
    expect(optimizarCompra).toHaveBeenLastCalledWith(ITEMS, -32.95, -60.65, 3);
  });

  it("sin zona espera a que se elija un punto", async () => {
    await mostrar(null);
    expect(optimizarCompra).not.toHaveBeenCalled();
    expect(contenedor.textContent).toContain("Elegí desde dónde salís a comprar");
  });
});
