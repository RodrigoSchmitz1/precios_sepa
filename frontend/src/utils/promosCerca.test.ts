import { describe, expect, it } from "vitest";
import type { PromoCerca } from "../types";
import {
  avisoPromoEnTitular,
  direccionPromo,
  promosQueConvienen,
  resumenPromosDeLista,
  textoOtrasSucursales,
  textoVigencia,
} from "./promosCerca";

function promo(precio_promo: number, extra: Partial<PromoCerca> = {}): PromoCerca {
  return {
    id_producto: "levite",
    descripcion: "LEVITE MANZANA 2,25L",
    cadena: "Dia",
    nombre_sucursal: "Dia 123",
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
    leyenda: "Vigencia desde el 10/11/2026 al 23/11/2026",
    nivel_evidencia: "leyenda",
    vigente_hasta: "2026-11-23",
    requiere_compra_multiple: false,
    ...extra,
  };
}

describe("promosQueConvienen", () => {
  it("se queda con las que bajan del precio más barato de la zona", () => {
    const promos = [promo(2470), promo(3600, { cadena: "Carrefour" })];
    expect(promosQueConvienen(promos, 3500).map((p) => p.cadena)).toEqual(["Dia"]);
  });

  it("Lomas: un café en promo que igual sale más que en Maxi no se muestra", () => {
    expect(promosQueConvienen([promo(6382.65, { cadena: "Carrefour" })], 5989)).toEqual([]);
  });

  it("al mismo precio no conviene", () => {
    expect(promosQueConvienen([promo(3500)], 3500)).toEqual([]);
  });

  it("sin precio de la zona, cualquier promo cercana sirve", () => {
    expect(promosQueConvienen([promo(2470)], undefined)).toHaveLength(1);
    expect(promosQueConvienen([promo(2470)], null)).toHaveLength(1);
  });

  it("sin promos, nada", () => {
    expect(promosQueConvienen(undefined, 3500)).toEqual([]);
  });
});

describe("textos de una promo", () => {
  it("vigencia en formato corto, o nada si la cadena no la dice", () => {
    expect(textoVigencia(promo(2470))).toBe("hasta el 23/11");
    expect(textoVigencia(promo(2470, { vigente_hasta: null }))).toBe("");
  });

  it("dirección con barrio, o localidad si no hay barrio", () => {
    expect(direccionPromo(promo(2470))).toBe("Av. Santa Fe 3253 · Palermo");
    expect(direccionPromo(promo(2470, { barrio: null, calle: "", numero: "" }))).toBe("Dia 123 · CABA");
  });

  it("la dirección en mayúsculas se escribe normal", () => {
    expect(direccionPromo(promo(2470, { calle: "CL THAMES", numero: "2447", barrio: "PALERMO" }))).toBe("Cl Thames 2447 · Palermo");
    expect(direccionPromo(promo(2470, { calle: "AV. DE MAYO", numero: "800", barrio: "SAN NICOLAS" }))).toBe("Av. de Mayo 800 · San Nicolas");
  });

  it("otras sucursales cerca", () => {
    expect(textoOtrasSucursales(promo(2470))).toBe("");
    expect(textoOtrasSucursales(promo(2470, { otras_sucursales_cerca: 1 }))).toBe("y en 1 sucursal más cerca");
    expect(textoOtrasSucursales(promo(2470, { otras_sucursales_cerca: 4 }))).toBe("y en 4 sucursales más cerca");
  });
});

describe("avisoPromoEnTitular", () => {
  it("Tres Arroyos: la promo cerca que baja del precio más bajo de la zona", () => {
    const coope = promo(4080, { cadena: "Cooperativa Obrera", calle: "Colón", numero: "33", barrio: null, localidad: "Tres Arroyos", vigente_hasta: "2026-11-30" });
    expect(avisoPromoEnTitular([coope], 4890).replace(/[\u00a0\u202f]/g, " ")).toBe(
      "Con promo: $ 4.080 en Cooperativa Obrera (Colón 33 · Tres Arroyos), hasta el 30/11",
    );
  });

  it("sin promo que gane, de compra múltiple o sin precio de zona, nada", () => {
    expect(avisoPromoEnTitular([promo(5000)], 4890)).toBe("");
    expect(avisoPromoEnTitular([promo(3000, { requiere_compra_multiple: true })], 4890)).toBe("");
    expect(avisoPromoEnTitular([promo(3000)], undefined)).toBe("");
    expect(avisoPromoEnTitular(null, 4890)).toBe("");
  });
});

describe("resumenPromosDeLista", () => {
  it("singular, plural y nada con cero", () => {
    expect(resumenPromosDeLista(1)).toBe("Esta semana 1 producto de tu lista está en promo cerca tuyo");
    expect(resumenPromosDeLista(2)).toBe("Esta semana 2 productos de tu lista están en promo cerca tuyo");
    expect(resumenPromosDeLista(0)).toBe("");
  });
});
