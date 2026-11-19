// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cotizarLista, obtenerPromosDeLista, obtenerPromosDeProductos } from "../api/client";
import { ContextoZona, type EstadoZona } from "../contexto/zona";
import type { ItemLista, PromoCerca, ResultadoLista } from "../types";
import type { Zona } from "../utils/zona";
import PromosCercaDelProducto from "./PromosCercaDelProducto";
import TuLista from "./TuLista";

/*
  Tu lista y el detalle con las promos cerca de la zona (openspec
  promos-de-tu-lista). Sin testing-library: react-dom y jsdom alcanzan.
*/

vi.mock("../api/client", () => ({
  cotizarLista: vi.fn(),
  obtenerPromosDeProductos: vi.fn(),
  obtenerPromosDeLista: vi.fn(() => Promise.resolve({ cadenas: [], poco_informan: [], radio_km: 3 })),
}));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const PALERMO: Zona = { nombre: "Palermo", provincia: "AR-C", latitud: -34.58, longitud: -58.42, cadenas: ["Dia", "Carrefour"] };

function promo(id_producto: string, cadena: string, precio_promo: number, extra: Partial<PromoCerca> = {}): PromoCerca {
  return {
    id_producto,
    descripcion: id_producto.toUpperCase(),
    cadena,
    nombre_sucursal: `${cadena} 1`,
    calle: "Av. Santa Fe",
    numero: "3253",
    barrio: "Palermo",
    localidad: "CABA",
    provincia: "AR-C",
    latitud: -34.58,
    longitud: -58.42,
    distancia_km: 0.4,
    otras_sucursales_cerca: 0,
    precio_lista: 3800,
    precio_promo,
    descuento_pct: 35,
    leyenda: null,
    nivel_evidencia: "leyenda",
    vigente_hasta: "2026-11-23",
    requiere_compra_multiple: false,
    ...extra,
  };
}

const LISTA: ItemLista[] = [
  { id_producto: "levite", nombre: "Levité manzana 2,25 L", cantidad: 1 },
  { id_producto: "cafe", nombre: "Café La Virginia 250 g", cantidad: 1 },
];

const fila = (cadena: string, total: number) => ({ cadena, total, productos_con_precio: 2, completa: true, faltan: [] });

const COTIZACION: ResultadoLista = {
  productos: LISTA.map((i) => ({ id_producto: i.id_producto })) as ResultadoLista["productos"],
  no_encontrados: [],
  cadenas: [fila("Día", 9489), fila("Carrefour", 9900)],
  combinando_cadenas: 9489,
  fecha_datos: "2026-11-17",
  zona: {
    cadenas: [fila("Día", 9489), fila("Carrefour", 9900)],
    combinando_cadenas: 9489,
    no_en_zona: [],
    mas_barato: { levite: { cadena: "Día", precio: 3500 }, cafe: { cadena: "Día", precio: 5989 } },
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
  vi.mocked(obtenerPromosDeProductos).mockResolvedValue({
    levite: [promo("levite", "Día", 2470)],
    // Baja el precio de Carrefour, pero igual sale mas que en Dia.
    cafe: [promo("cafe", "Carrefour", 6382.65)],
  });
});

afterEach(() => {
  act(() => raiz.unmount());
  contenedor.remove();
  vi.clearAllMocks();
});

async function mostrarLista(zona: Zona | null) {
  const nada = () => {};
  await act(async () => {
    raiz.render(
      <ContextoZona.Provider value={estadoZona(zona)}>
        <TuLista lista={LISTA} onCambiarCantidad={nada} onQuitar={nada} onVaciar={nada} onVer={nada} />
      </ContextoZona.Provider>,
    );
  });
  // Las dos esperas de 250 ms de la cotizacion y de las promos.
  await act(async () => {
    await new Promise((listo) => setTimeout(listo, 400));
  });
  return textoVisible();
}

/** El texto de la pantalla, con los espacios duros de Intl como espacios comunes. */
function textoVisible() {
  return (contenedor.textContent ?? "").replace(/[\u00a0\u202f]/g, " ");
}

describe("Tu lista con promos cerca", () => {
  it("muestra la promo que conviene, dice cuántas hay y no toca el total", async () => {
    const texto = await mostrarLista(PALERMO);
    expect(texto).toContain("Esta semana 1 producto de tu lista está en promo cerca tuyo");
    expect(texto).toContain("−35% en Día");
    expect(texto).toContain("$ 2.470");
    expect(texto).toContain("hasta el 23/11");
    expect(texto).toContain("lo declara la cadena");
    // La del café no baja del precio de la zona.
    expect(texto).not.toContain("6.383");
    // El total de Dia sigue siendo el de la cotización.
    expect(texto).toContain("$ 9.489");
    expect(obtenerPromosDeProductos).toHaveBeenCalledWith(["levite", "cafe"], { latitud: -34.58, longitud: -58.42 });
  });

  it("sin promos que convengan no dice nada de promos", async () => {
    vi.mocked(obtenerPromosDeProductos).mockResolvedValue({ cafe: [promo("cafe", "Carrefour", 6382.65)] });
    const texto = await mostrarLista(PALERMO);
    expect(texto).not.toContain("en promo cerca");
    expect(texto).not.toContain("0 productos");
  });

  it("si las promos fallan, la lista se ve igual", async () => {
    vi.mocked(obtenerPromosDeProductos).mockRejectedValue(new Error("caida"));
    const texto = await mostrarLista(PALERMO);
    expect(texto).toContain("$ 9.489");
    expect(texto).not.toContain("en promo cerca");
    expect(texto).not.toContain("caida");
  });

  it("total con promos: aparte, con la sucursal y las cadenas que no informan, sin tocar el total", async () => {
    // total-con-promos-cerca
    vi.mocked(obtenerPromosDeLista).mockResolvedValue({
      cadenas: [
        {
          cadena: "Carrefour", nombre_sucursal: "Carrefour 1", calle: "Av. Santa Fe", numero: "3253", barrio: "Palermo",
          localidad: "CABA", provincia: "AR-C", latitud: 0, longitud: 0, distancia_km: 0.6,
          total_con_promos: 9000, total_lista: 9900, productos_en_promo: 2, vigente_hasta: "2026-11-23",
        },
      ],
      poco_informan: ["Coto"],
      radio_km: 3,
    });
    const texto = await mostrarLista(PALERMO);
    expect(texto).toContain("Con las promos de esta semana conviene Carrefour (Av. Santa Fe 3253 · Palermo): te sale $ 9.000, 2 de tus productos en promo, hasta el 23/11.");
    expect(texto).toContain("Coto casi no informa promos en SEPA");
    // El total de siempre sigue siendo el de la cotización.
    expect(texto).toContain("$ 9.489");
  });

  it("sin zona invita a elegirla y no pide promos", async () => {
    const texto = await mostrarLista(null);
    expect(texto).toContain("Elegí tu zona arriba y te mostramos qué productos de tu lista están en promo cerca tuyo");
    expect(obtenerPromosDeProductos).not.toHaveBeenCalled();
  });
});

describe("Promos cerca en el detalle", () => {
  async function mostrarDetalle(precioZona: number | undefined) {
    await act(async () => {
      raiz.render(<PromosCercaDelProducto idProducto="aceite" zona={PALERMO} precioZona={precioZona} />);
    });
    return textoVisible();
  }

  beforeEach(() => {
    vi.mocked(obtenerPromosDeProductos).mockResolvedValue({
      aceite: [promo("aceite", "Día", 5490), promo("aceite", "Carrefour", 5800), promo("aceite", "Coto", 7000)],
    });
  });

  it("las que bajan del precio de la zona, la más barata primero", async () => {
    const texto = await mostrarDetalle(6649);
    expect(texto).toContain("En promo cerca tuyo");
    expect(texto.indexOf("en Día")).toBeLessThan(texto.indexOf("en Carrefour"));
    expect(texto).not.toContain("en Coto");
  });

  it("sin ninguna que convenga, no hay bloque", async () => {
    expect(await mostrarDetalle(5000)).toBe("");
  });
});
