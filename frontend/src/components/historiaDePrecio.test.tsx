// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cotizarLista, obtenerPromosDeProductos } from "../api/client";
import { ContextoZona, type EstadoZona } from "../contexto/zona";
import { FilasDePrecios } from "../pages/MismoProductoPage";
import type { ItemLista, PrecioEnCadena, ResultadoLista } from "../types";
import type { Zona } from "../utils/zona";
import TuLista from "./TuLista";

/*
  El cambio de precio en el detalle y en Tu lista (openspec historia-de-precio).
  Sin testing-library: react-dom y jsdom alcanzan.
*/

vi.mock("../api/client", () => ({
  cotizarLista: vi.fn(),
  obtenerPromosDeProductos: vi.fn(),
  obtenerPromosDeLista: vi.fn(() => Promise.resolve({ cadenas: [], poco_informan: [], radio_km: 3 })),
}));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const PALERMO: Zona = { nombre: "Palermo", provincia: "AR-C", latitud: -34.58, longitud: -58.42, cadenas: ["Dia", "Carrefour"] };

const LISTA: ItemLista[] = [
  { id_producto: "yerba", nombre: "Yerba Playadito 1 kg", cantidad: 1 },
  { id_producto: "aceite", nombre: "Aceite Natura 1,5 L", cantidad: 1 },
];

const fila = (cadena: string, total: number) => ({ cadena, total, productos_con_precio: 2, completa: true, faltan: [] });

const COTIZACION: ResultadoLista = {
  productos: LISTA.map((i) => ({ id_producto: i.id_producto })) as ResultadoLista["productos"],
  no_encontrados: [],
  cadenas: [fila("Día", 7600), fila("Carrefour", 8100)],
  combinando_cadenas: 7600,
  fecha_datos: "2026-11-26",
  zona: {
    cadenas: [fila("Día", 7600), fila("Carrefour", 8100)],
    combinando_cadenas: 7600,
    no_en_zona: [],
    mas_barato: {
      yerba: { cadena: "Día", precio: 3600, cambio: { precio_anterior: 3830, fecha: "2026-11-25", pct: -6 } },
      // El aceite cambio en Carrefour, pero conviene en Dia: la API manda el de Dia, sin cambio.
      aceite: { cadena: "Día", precio: 4000, cambio: null },
    },
  },
};

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
  vi.mocked(cotizarLista).mockResolvedValue(COTIZACION);
  vi.mocked(obtenerPromosDeProductos).mockResolvedValue({});
});

afterEach(() => {
  act(() => raiz.unmount());
  contenedor.remove();
  vi.clearAllMocks();
});

function textoVisible() {
  return (contenedor.textContent ?? "").replace(/[\u00a0\u202f]/g, " ");
}

async function mostrarLista(zona: Zona | null) {
  const nada = () => {};
  await act(async () => {
    raiz.render(
      <ContextoZona.Provider value={estadoZona(zona)}>
        <TuLista lista={LISTA} onCambiarCantidad={nada} onQuitar={nada} onVaciar={nada} onVer={nada} />
      </ContextoZona.Provider>,
    );
  });
  await act(async () => {
    await new Promise((listo) => setTimeout(listo, 400));
  });
  return textoVisible();
}

describe("Tu lista con el cambio de precio", () => {
  it("dice el cambio de la cadena más barata de la zona, debajo del producto", async () => {
    const texto = await mostrarLista(PALERMO);
    expect(texto).toContain("Bajó 6% en Día el 25/11");
    const yerba = [...contenedor.querySelectorAll("li")].find((li) => li.textContent?.includes("Yerba"));
    expect(yerba?.textContent).toContain("Bajó 6%");
    const aceite = [...contenedor.querySelectorAll("li")].find((li) => li.textContent?.includes("Aceite"));
    expect(aceite?.textContent).not.toMatch(/Subió|Bajó/);
    // El total sigue siendo el de la cotización.
    expect(texto).toContain("$ 7.600");
  });

  it("sin zona no dice ningún cambio", async () => {
    const texto = await mostrarLista(null);
    expect(texto).not.toMatch(/Subió|Bajó/);
  });
});

describe("El detalle con el cambio de precio", () => {
  const precio = (cadena: string, precio_mediano: number, cambio: PrecioEnCadena["cambio"]): PrecioEnCadena => ({
    cadena,
    precio_mediano,
    precio_minimo: precio_mediano,
    precio_maximo: precio_mediano,
    sucursales: 80,
    precio_creible: true,
    fecha_precio: "2026-11-26",
    cambio,
  });

  it("la cadena que cambió lo dice con el precio anterior; las otras, nada", async () => {
    await act(async () => {
      raiz.render(
        <FilasDePrecios
          fechaDatos="2026-11-26"
          precios={[
            precio("Día", 3600, { precio_anterior: 4000, fecha: "2026-11-25", pct: -10 }),
            precio("Coto", 4300, { precio_anterior: 4000, fecha: "2026-11-20", pct: 7.5 }),
            precio("Carrefour", 4100, null),
          ]}
        />,
      );
    });
    const filas = [...contenedor.querySelectorAll("li")].map((li) => (li.textContent ?? "").replace(/[\u00a0\u202f]/g, " "));
    expect(filas[0]).toContain("Bajó 10% el 25/11 (antes $ 4.000)");
    expect(filas[1]).toContain("Subió 8% el 20/11 (antes $ 4.000)");
    expect(filas[2]).not.toMatch(/Subió|Bajó|sin cambios/i);
  });
});
