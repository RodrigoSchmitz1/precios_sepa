import { describe, expect, it } from "vitest";
import type { ListaConPromos, PromosDeLista } from "../types";
import { avisoPocoInforman, lineaPromosDeLista } from "./promosDeLista";

const normal = (t: string) => t.replace(/[\u00a0\u202f]/g, " ");

function cadena(nombre: string, total_con_promos: number, total_lista: number, productos_en_promo: number, extra: Partial<ListaConPromos> = {}): ListaConPromos {
  return {
    cadena: nombre,
    nombre_sucursal: `${nombre} 1`,
    calle: "CL THAMES",
    numero: "2447",
    barrio: "Palermo",
    localidad: "CABA",
    provincia: "AR-C",
    latitud: 0,
    longitud: 0,
    distancia_km: 0.2,
    total_con_promos,
    total_lista,
    productos_en_promo,
    vigente_hasta: "2026-11-23",
    ...extra,
  };
}

const datos = (cadenas: ListaConPromos[], poco_informan: string[] = []): PromosDeLista => ({ cadenas, poco_informan, radio_km: 3 });

describe("lineaPromosDeLista", () => {
  it("con promos cambia la más barata: lo dice con la sucursal, los productos y la vigencia", () => {
    const l = lineaPromosDeLista(datos([cadena("Día", 31200, 33000, 6), cadena("Maxi (Carrefour)", 32000, 32000, 0)], ["Coto", "Jumbo"]), {
      cadena: "Maxi (Carrefour)",
      total: 32000,
    })!;
    expect(l.cambia).toBe(true);
    expect(normal(l.texto)).toBe("Con las promos de esta semana conviene Día (Cl Thames 2447 · Palermo): te sale $ 31.200, 6 de tus productos en promo, hasta el 23/11.");
    expect(l.aviso).toBe("Coto y Jumbo casi no informan promos en SEPA: si tienen, no están en esta cuenta.");
  });

  it("gana la misma pero baja al menos 1%: lo dice sin 'conviene'", () => {
    const l = lineaPromosDeLista(datos([cadena("Día", 30000, 31200, 2, { vigente_hasta: null })]), { cadena: "Día", total: 31200 })!;
    expect(l.cambia).toBe(false);
    expect(normal(l.texto)).toBe("Con las promos de esta semana, en Día (Cl Thames 2447 · Palermo) te sale $ 30.000, 2 de tus productos en promo.");
  });

  it("sin cambios que valgan la pena, nada", () => {
    expect(lineaPromosDeLista(datos([cadena("Día", 31100, 31200, 1)]), { cadena: "Día", total: 31200 })).toBeNull();
    expect(lineaPromosDeLista(datos([cadena("Maxi (Carrefour)", 32000, 32000, 0)]), { cadena: "Maxi (Carrefour)", total: 32000 })).toBeNull();
    expect(lineaPromosDeLista(datos([]), { cadena: "Día", total: 1 })).toBeNull();
    expect(lineaPromosDeLista(undefined, { cadena: "Día", total: 1 })).toBeNull();
  });
});

describe("avisoPocoInforman", () => {
  it("singular, plural y nada", () => {
    expect(avisoPocoInforman(["Vea"])).toBe("Vea casi no informa promos en SEPA: si tiene, no están en esta cuenta.");
    expect(avisoPocoInforman(["Changomas", "Coto"])).toBe("Changomás y Coto casi no informan promos en SEPA: si tienen, no están en esta cuenta.");
    expect(avisoPocoInforman([])).toBe("");
  });
});
