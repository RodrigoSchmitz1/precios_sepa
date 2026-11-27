// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, Route, Routes, useLocation } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { dondeComprarLista, interpretarCanasta, obtenerSugeridos } from "../api/client";
import { ContextoZona, type EstadoZona } from "../contexto/zona";
import AMiCompra from "./AMiCompra";
import type { ProductoSugerido, ResultadoDondeComprar } from "../types";
import { CLAVE_LISTA, leerLista } from "../utils/lista";
import type { Zona } from "../utils/zona";
import ArmarCompra from "./ArmarCompra";
import DondeComprarLista from "./DondeComprarLista";
import ProveedorLista from "./ProveedorLista";

/* Mi compra (openspec mi-compra). */

vi.mock("../api/client", () => ({
  interpretarCanasta: vi.fn(),
  obtenerSugeridos: vi.fn(),
  obtenerComposicionCanasta: vi.fn(),
  dondeComprarLista: vi.fn(),
}));
vi.mock("./MapaZona", () => ({ default: () => <div data-testid="mapa" /> }));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const PALERMO: Zona = { nombre: "Palermo", provincia: "AR-C", latitud: -34.58, longitud: -58.42, cadenas: ["Coto", "Dia"] };

function estadoZona(zona: Zona | null): EstadoZona {
  const nada = () => {};
  return { zona, zonas: [], lista: true, aviso: null, elegir: nada, usarUbicacion: nada, ubicando: false, errorUbicacion: null, cerrarAviso: nada };
}

const YERBA: ProductoSugerido = {
  id_producto: "7790387000014", descripcion: "YERBA MATE SUAVE", marca: "PLAYADITO", categoria: "Yerba mate",
  cantidad_normalizada: 500, unidad_normalizada: "g", precio_mas_bajo: 2500, sucursales: 900,
} as ProductoSugerido;

const texto = (el: Element) => (el.textContent ?? "").replace(/\u00a0/g, " ");

let contenedor: HTMLDivElement;
let raiz: Root;

beforeEach(() => {
  window.localStorage.clear();
  contenedor = document.createElement("div");
  document.body.appendChild(contenedor);
  raiz = createRoot(contenedor);
  vi.mocked(obtenerSugeridos).mockResolvedValue({ "Yerba mate": [YERBA] });
});

afterEach(() => {
  act(() => raiz.unmount());
  contenedor.remove();
  vi.clearAllMocks();
});

async function mostrar(nodo: React.ReactNode, zona: Zona | null = PALERMO, ruta = "/lista") {
  await act(async () => {
    raiz.render(
      <MemoryRouter initialEntries={[ruta]}>
        <ContextoZona.Provider value={estadoZona(zona)}>
          <ProveedorLista>{nodo}</ProveedorLista>
        </ContextoZona.Provider>
      </MemoryRouter>,
    );
  });
}

const boton = (t: string) => [...contenedor.querySelectorAll("button")].find((b) => b.textContent?.includes(t)) as HTMLButtonElement;

async function tocar(t: string) {
  const b = boton(t);
  if (!b) throw new Error(`No hay botón "${t}"`);
  await act(async () => b.click());
}

function escribir(campo: HTMLTextAreaElement, valor: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!;
  act(() => {
    setter.call(campo, valor);
    campo.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

describe("Armar la compra", () => {
  it("contando el hogar: la yerba de 500 g para 2 kg entra con 4 unidades", async () => {
    vi.mocked(interpretarCanasta).mockResolvedValue({
      items: [{ categoria: "Yerba mate", cantidad: 2000, unidad: "g", gama: "medio", razon: "" }],
    });
    await mostrar(<ArmarCompra onVer={() => {}} />);
    await tocar("Contanos quiénes viven en tu casa");
    escribir(contenedor.querySelector("textarea")!, "somos 2 adultos y 2 chicos");
    await tocar("Armar mi compra");
    expect(interpretarCanasta).toHaveBeenCalledWith("somos 2 adultos y 2 chicos");
    await tocar("Sumar 4");
    expect(leerLista()).toEqual([expect.objectContaining({ id_producto: YERBA.id_producto, cantidad: 4 })]);
  });

  it("si la IA está al límite, lo dice y ofrece la canasta básica", async () => {
    vi.mocked(interpretarCanasta).mockRejectedValue(new Error("Hay muchas canastas armándose al mismo tiempo. Probá de nuevo en un minuto."));
    await mostrar(<ArmarCompra onVer={() => {}} />);
    await tocar("Contanos quiénes viven en tu casa");
    escribir(contenedor.querySelector("textarea")!, "vivo solo");
    await tocar("Armar mi compra");
    expect(texto(contenedor)).toContain("Probá de nuevo en un minuto");
    await tocar("Empezar con la canasta básica");
    expect(texto(contenedor)).toContain("Adultos");
  });

  it("ofrece la canasta guardada y no vuelve después de descartarla", async () => {
    const { guardarEnNavegador } = await import("../utils/canastaGuardada");
    guardarEnNavegador({ items: [{ categoria: "Yerba mate", cantidad: 1000, unidad: "g", gama: "medio", razon: "" }], localidades: [] } as never);
    await mostrar(<ArmarCompra onVer={() => {}} />);
    expect(texto(contenedor)).toContain("Tenés una canasta guardada");
    await tocar("Descartar");
    expect(texto(contenedor)).not.toContain("Tenés una canasta guardada");
    act(() => raiz.unmount());
    raiz = createRoot(contenedor);
    await mostrar(<ArmarCompra onVer={() => {}} />);
    expect(texto(contenedor)).not.toContain("Tenés una canasta guardada");
  });
});

const LISTA = [{ id_producto: "a", nombre: "A", cantidad: 1 }, { id_producto: "b", nombre: "B", cantidad: 2 }];
const sucursal = (cadena: string, subtotal: number) => ({
  id: cadena, cadena, nombre_sucursal: cadena, direccion: "Calle 1", localidad: "Palermo", provincia: "AR-C",
  latitud: -34.58, longitud: -58.42, distancia_km: 0.5, subtotal,
  productos: [{ id_producto: "a", descripcion: "PRODUCTO A", cantidad: 1, precio_unitario: subtotal, costo: subtotal }],
});

describe("Dónde comprarla cerca", () => {
  it("un ahorro de menos del 5% se dice como casi lo mismo", async () => {
    vi.mocked(dondeComprarLista).mockResolvedValue({
      radio_km: 3, productos: 2, sin_precio_cerca: [],
      opciones: [
        { max_sucursales: 1, total: 96000, productos_cubiertos: 2, distancia_suma_km: 2, sucursales: [sucursal("Vea", 96000)] },
        { max_sucursales: 2, total: 95808, productos_cubiertos: 2, distancia_suma_km: 3, sucursales: [sucursal("Vea", 80040), sucursal("Jumbo", 15768)] },
      ],
    });
    await mostrar(<DondeComprarLista lista={LISTA} />);
    await tocar("Hasta 2");
    expect(texto(contenedor)).toContain("Hacer más paradas ahorra solo $ 192");
    expect(texto(contenedor)).not.toContain("Ahorrás");
  });

  it("sin zona pide elegirla", async () => {
    window.localStorage.setItem(CLAVE_LISTA, JSON.stringify(LISTA));
    await mostrar(<DondeComprarLista lista={LISTA} />, null);
    expect(texto(contenedor)).toContain("Elegí tu zona");
    expect(dondeComprarLista).not.toHaveBeenCalled();
  });

  it("muestra 1 y 2 paradas con el ahorro y aclara el precio por cadena", async () => {
    const r: ResultadoDondeComprar = {
      radio_km: 3, productos: 2, sin_precio_cerca: [],
      opciones: [
        { max_sucursales: 1, total: 28000, productos_cubiertos: 2, distancia_suma_km: 0.5, sucursales: [sucursal("Dia", 28000)] },
        { max_sucursales: 2, total: 26500, productos_cubiertos: 2, distancia_suma_km: 1, sucursales: [sucursal("Dia", 16000), sucursal("Coto", 10500)] },
      ],
    };
    vi.mocked(dondeComprarLista).mockResolvedValue(r);
    await mostrar(<DondeComprarLista lista={LISTA} />);
    expect(dondeComprarLista).toHaveBeenCalledWith([{ id_producto: "a", cantidad: 1 }, { id_producto: "b", cantidad: 2 }], -34.58, -58.42, 3);
    expect(texto(contenedor)).toContain("precio de cada cadena para todo el país");
    await tocar("Hasta 2");
    expect(texto(contenedor)).toContain("Ahorrás $ 1.500 contra hacer toda la compra en un solo súper");
    expect(texto(contenedor)).toContain("Coto");
  });

  it("sin sucursales en el radio ofrece uno más grande", async () => {
    vi.mocked(dondeComprarLista).mockResolvedValue({ radio_km: 3, productos: 2, sin_precio_cerca: [], opciones: [] });
    await mostrar(<DondeComprarLista lista={LISTA} />);
    expect(texto(contenedor)).toContain("No hay súper con estos productos a menos de 3 km");
    await tocar("Buscar a 5 km");
    expect(vi.mocked(dondeComprarLista).mock.calls.at(-1)?.[3]).toBe(5);
  });
});

describe("Tu canasta lleva a Mi compra", () => {
  it("conserva la zona del link", async () => {
    function Donde() {
      const { pathname, search } = useLocation();
      return <p data-testid="donde">{pathname + search}</p>;
    }
    await act(async () => {
      raiz.render(
        <MemoryRouter initialEntries={["/canasta-personalizada?zona=AR-C:Palermo"]}>
          <Routes>
            <Route path="/canasta-personalizada" element={<AMiCompra />} />
            <Route path="/lista" element={<Donde />} />
          </Routes>
        </MemoryRouter>,
      );
    });
    expect(contenedor.querySelector("[data-testid=donde]")?.textContent).toBe("/lista?zona=AR-C:Palermo");
  });
});

describe("la zona guardada no parpadea (app-para-el-usuario)", () => {
  it("mientras se sabe si hay zona, Dónde comprarla dice Cargando y no pide elegir zona", async () => {
    window.localStorage.setItem(CLAVE_LISTA, JSON.stringify([{ id_producto: "1", nombre: "Yerba", cantidad: 1 }]));
    const nada = () => {};
    await act(async () => {
      raiz.render(
        <MemoryRouter initialEntries={["/lista"]}>
          <ContextoZona.Provider
            value={{ zona: null, zonas: [], lista: false, aviso: null, elegir: nada, usarUbicacion: nada, ubicando: false, errorUbicacion: null, cerrarAviso: nada }}
          >
            <ProveedorLista>
              <DondeComprarLista lista={leerLista()} />
            </ProveedorLista>
          </ContextoZona.Provider>
        </MemoryRouter>,
      );
    });
    expect(texto(contenedor)).not.toContain("Elegí tu zona");
    expect(texto(contenedor)).toContain("Cargando");
  });
});
