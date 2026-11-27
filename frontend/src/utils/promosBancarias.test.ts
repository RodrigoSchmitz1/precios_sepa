// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import type { PromoBancaria } from "../types";
import { formatearPesos } from "./formato";
import {
  condicionesDePromo,
  diaDeLaSemana,
  entidadesDePromos,
  opcionesDeCadena,
  pagoConPromo,
  promosDelDia,
  proximoDiaConPromos,
} from "./promosBancarias";
import { alternar, CLAVE_TARJETAS, guardarTarjetas, leerTarjetas } from "./tarjetas";

/* Promos bancarias y Mis tarjetas (openspec promos-bancarias). */

const promo = (cambios: Partial<PromoBancaria> = {}): PromoBancaria => ({
  id: "dia-modo",
  cadenas: ["Dia"],
  entidad: "MODO",
  medio: "qr",
  segmento: null,
  dias: ["jueves"],
  porcentaje: 20,
  tipo: "reintegro",
  canal: "ambos",
  tope: 10000,
  tope_periodo: "mes",
  compra_minima: null,
  rubros: null,
  acumula: "no_se_sabe",
  vigente_desde: "2026-11-01",
  vigente_hasta: "2026-11-30",
  fuente: "https://diaonline.supermercadosdia.com.ar/medios-de-pago-y-promociones",
  revisada: "2026-11-27",
  ...cambios,
});

afterEach(() => window.localStorage.clear());

describe("días", () => {
  it("el 27 de noviembre de 2026 es viernes y mañana sábado", () => {
    expect(diaDeLaSemana("2026-11-27")).toBe("viernes");
    expect(diaDeLaSemana("2026-11-27", 1)).toBe("sabado");
  });
});

describe("pagoConPromo", () => {
  it("reintegro con tope: paga todo en caja y le devuelven el tope", () => {
    expect(pagoConPromo(54619, promo(), null)).toEqual({ estado: "ok", pagaEnCaja: 54619, teDevuelven: 10000, ahorro: 10000, topeAplicado: true });
  });

  it("descuento en caja del 25 % sin tope", () => {
    const r = pagoConPromo(57212, promo({ tipo: "descuento", porcentaje: 25, tope: null, tope_periodo: null, entidad: "Banco Ciudad" }), null);
    expect(r).toEqual({ estado: "ok", pagaEnCaja: 42909, teDevuelven: 0, ahorro: 14303, topeAplicado: false });
  });

  it("solo algunos rubros queda a confirmar, sin monto", () => {
    expect(pagoConPromo(50000, promo({ porcentaje: 40, rubros: ["Galletitas", "Gaseosas"] }), null)).toEqual({ estado: "a-confirmar", motivo: "solo algunos rubros" });
  });

  it("un segmento no marcado queda a confirmar; marcado, se calcula", () => {
    const p = promo({ segmento: "jubilados" });
    expect(pagoConPromo(50000, p, null)).toEqual({ estado: "a-confirmar", motivo: "solo jubilados" });
    expect(pagoConPromo(50000, p, { entidades: ["MODO"], segmentos: ["jubilados"] }).estado).toBe("ok");
  });

  it("debajo de la compra mínima dice cuánto falta", () => {
    expect(pagoConPromo(20000, promo({ compra_minima: 35000 }), null)).toEqual({ estado: "falta-minimo", minimo: 35000, falta: 15000 });
  });
});

describe("promosDelDia y opciones", () => {
  const PROMOS = [
    promo({ id: "a", cadenas: ["Dia"], entidad: "MODO", porcentaje: 20 }),
    promo({ id: "b", cadenas: ["Coto"], entidad: "Banco Ciudad", porcentaje: 25, tipo: "descuento", tope: null }),
    promo({ id: "c", cadenas: ["Maxi (Carrefour)"], entidad: "Banco Nación", porcentaje: 30 }),
    promo({ id: "d", cadenas: ["Dia"], entidad: "Banco Nación", porcentaje: 15, dias: ["martes"] }),
  ];

  it("solo las de ese día y de las cadenas de la zona", () => {
    expect(promosDelDia(PROMOS, "jueves", ["Dia", "Coto"], null).map((p) => p.id)).toEqual(["b", "a"]);
  });

  it("con tarjetas marcadas, solo las suyas; con soloMias en falso, todas", () => {
    const tarjetas = { entidades: ["MODO"], segmentos: [] };
    expect(promosDelDia(PROMOS, "jueves", ["Dia", "Coto"], tarjetas).map((p) => p.id)).toEqual(["a"]);
    expect(promosDelDia(PROMOS, "jueves", ["Dia", "Coto"], tarjetas, false)).toHaveLength(2);
  });

  it("el próximo día con promos", () => {
    // 2026-11-27 es viernes: el próximo con promos en Día es el martes, en 4 días.
    expect(proximoDiaConPromos([PROMOS[3]], "2026-11-27", ["Dia"], null)).toEqual({ dia: "martes", enDias: 4 });
  });

  it("la mejor promo calculable de una cadena; las online quedan afuera por defecto", () => {
    const deHoy = [
      promo({ id: "x", porcentaje: 10, tope: null }),
      promo({ id: "y", porcentaje: 30, tope: 2000 }),
      promo({ id: "z", porcentaje: 35, canal: "online", tope: null }),
    ];
    const r = opcionesDeCadena(50000, "Dia", deHoy, null);
    expect(r.mejor?.promo.id).toBe("x");
    expect(r.otras.map((o) => o.promo.id)).toEqual(["y"]);
  });

  it("entidades para elegir en Mis tarjetas", () => {
    expect(entidadesDePromos(PROMOS)).toEqual(["Banco Ciudad", "Banco Nación", "MODO"]);
  });

  it("las condiciones en una línea", () => {
    expect(condicionesDePromo(promo({ compra_minima: 35000 }), formatearPesos).replace(/\s/g, " ")).toBe(
      "Reintegro · sucursal y online · tope $ 10.000 por mes · desde $ 35.000"
    );
  });
});

describe("Mis tarjetas", () => {
  it("se guardan y se leen en el teléfono", () => {
    guardarTarjetas({ entidades: ["MODO", "Banco Nación"], segmentos: [] });
    expect(leerTarjetas()).toEqual({ entidades: ["MODO", "Banco Nación"], segmentos: [] });
  });

  it("con datos rotos vuelve vacío", () => {
    window.localStorage.setItem(CLAVE_TARJETAS, "{roto");
    expect(leerTarjetas()).toEqual({ entidades: [], segmentos: [] });
  });

  it("alternar marca y desmarca", () => {
    expect(alternar(["MODO"], "Banco Nación")).toEqual(["MODO", "Banco Nación"]);
    expect(alternar(["MODO"], "MODO")).toEqual([]);
  });
});
