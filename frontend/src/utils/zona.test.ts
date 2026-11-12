// @vitest-environment jsdom
/*
  La zona compartida (openspec/changes/zona-compartida): guardarla, leerla del
  link sin pisar los otros parametros, buscarla y resolver la ubicacion.
*/
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buscarZonas,
  cadenasVisibles,
  localidadDeZona,
  guardarZona,
  leerZonaGuardada,
  parametroAZona,
  rotuloZona,
  searchConZona,
  zonaInicial,
  zonaMasCercana,
  type Zona,
} from "./zona";

function zona(nombre: string, provincia: string, latitud = 0, longitud = 0, cadenas: string[] = []): Zona {
  return { nombre, provincia, latitud, longitud, cadenas };
}

const PALERMO = zona("Palermo", "AR-C", -34.5811, -58.4245, ["Coto", "Dia"]);
const BELGRANO = zona("Belgrano", "AR-C", -34.5627, -58.4566);
const NUNEZ = zona("Núñez", "AR-C", -34.5446, -58.4632);
const ROSARIO = zona("Rosario", "AR-S", -32.9468, -60.6393);
const SAN_MARTIN_PBA = zona("San Martín", "AR-B", -34.57, -58.53);
const SAN_MARTIN_MZA = zona("San Martín", "AR-M", -33.08, -68.47);
const ZONAS = [PALERMO, BELGRANO, NUNEZ, ROSARIO, SAN_MARTIN_PBA, SAN_MARTIN_MZA];

afterEach(() => {
  window.localStorage.clear();
  vi.restoreAllMocks();
});

describe("guardar y leer la zona", () => {
  it("guarda y recupera nombre y provincia", () => {
    guardarZona(PALERMO);
    expect(leerZonaGuardada()).toEqual({ provincia: "AR-C", nombre: "Palermo" });
    guardarZona(null);
    expect(leerZonaGuardada()).toBeNull();
  });

  it("sigue andando si el navegador no deja guardar", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("QuotaExceededError");
    });
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("SecurityError");
    });
    expect(() => guardarZona(PALERMO)).not.toThrow();
    expect(leerZonaGuardada()).toBeNull();
  });
});

describe("la zona en el link", () => {
  it("no pisa los demas parametros", () => {
    expect(searchConZona("?q=yerba&c=abc", PALERMO)).toBe("?q=yerba&c=abc&zona=AR-C%3APalermo");
    expect(searchConZona("?q=yerba&zona=AR-C%3APalermo", null)).toBe("?q=yerba");
    expect(searchConZona("", null)).toBe("");
  });

  it("lee nombres con tildes y espacios", () => {
    const search = searchConZona("", SAN_MARTIN_MZA);
    expect(parametroAZona(new URLSearchParams(search).get("zona"))).toEqual({ provincia: "AR-M", nombre: "San Martín" });
    expect(parametroAZona("sin-dos-puntos")).toBeNull();
    expect(parametroAZona(":Palermo")).toBeNull();
  });

  it("el link gana sobre la guardada", () => {
    const { zona: elegida } = zonaInicial(ZONAS, "?zona=AR-C%3APalermo", { provincia: "AR-S", nombre: "Rosario" });
    expect(elegida).toBe(PALERMO);
  });

  it("una zona del link que no existe se descarta y se avisa", () => {
    const r = zonaInicial(ZONAS, "?zona=AR-C%3AInventado", { provincia: "AR-S", nombre: "Rosario" });
    expect(r).toEqual({ zona: ROSARIO, desconocida: "Inventado" });
  });

  it("sin link usa la guardada, si todavia existe", () => {
    expect(zonaInicial(ZONAS, "", { provincia: "AR-S", nombre: "rosario" }).zona).toBe(ROSARIO);
    expect(zonaInicial(ZONAS, "", { provincia: "AR-C", nombre: "Ya no existe" }).zona).toBeNull();
  });
});

describe("buscar la zona", () => {
  it("sin tildes ni mayusculas", () => {
    expect(buscarZonas(ZONAS, "nunez")).toEqual([NUNEZ]);
  });

  it("ofrece los homonimos de cada provincia", () => {
    expect(buscarZonas(ZONAS, "san martin").map(rotuloZona)).toEqual(["San Martín, Buenos Aires", "San Martín, Mendoza"]);
  });

  it("no busca con menos de dos letras", () => {
    expect(buscarZonas(ZONAS, "p")).toEqual([]);
  });
});

describe("usar mi ubicacion", () => {
  it("elige el lugar mas cercano", () => {
    expect(zonaMasCercana(ZONAS, -34.582, -58.43)).toBe(PALERMO);
    expect(zonaMasCercana(ZONAS, -34.56, -58.455)).toBe(BELGRANO);
  });

  it("en el limite entre dos barrios gana el centro mas cercano", () => {
    // Un punto apenas mas cerca del centro de Belgrano que del de Palermo.
    const medio = { lat: (PALERMO.latitud + BELGRANO.latitud) / 2 + 0.001, lng: (PALERMO.longitud + BELGRANO.longitud) / 2 - 0.001 };
    expect(zonaMasCercana(ZONAS, medio.lat, medio.lng)).toBe(BELGRANO);
  });

  it("sin lugares no elige nada", () => {
    expect(zonaMasCercana([], -34.6, -58.4)).toBeNull();
  });
});

describe("la zona en Tu canasta", () => {
  it("encuentra la localidad cotizable con el mismo nombre y provincia", () => {
    const opciones = [{ localidad: "ROSARIO", provincia: "AR-S" }, { localidad: "Rosario de la Frontera", provincia: "AR-A" }];
    expect(localidadDeZona(opciones, ROSARIO)).toEqual({ localidad: "ROSARIO", provincia: "AR-S" });
  });

  it("sin coincidencia exacta no agrega nada", () => {
    expect(localidadDeZona([{ localidad: "San Martín", provincia: "AR-B" }], SAN_MARTIN_MZA)).toBeNull();
    expect(localidadDeZona([], PALERMO)).toBeNull();
  });
});

describe("cadenas de la zona", () => {
  it("se comparan con los nombres que se muestran", () => {
    expect(cadenasVisibles(PALERMO)).toEqual(new Set(["Coto", "Día"]));
  });
});
