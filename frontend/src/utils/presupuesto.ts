/*
  Presupuesto del mes de Mis gastos (openspec mis-gastos-para-volver). Queda en
  el telefono, como los gastos; todo acceso a localStorage va envuelto.
*/
const CLAVE = "changuito.presupuesto.v1";
/** Desde que fraccion del presupuesto se avisa que se esta cerca del tope. */
export const AVISO_PRESUPUESTO = 0.8;

export function leerPresupuesto(): number | null {
  try {
    const datos = JSON.parse(window.localStorage.getItem(CLAVE) ?? "null");
    return typeof datos?.monto === "number" && datos.monto > 0 ? datos.monto : null;
  } catch {
    return null;
  }
}

/** true si quedo guardado; null lo saca. */
export function guardarPresupuesto(monto: number | null): boolean {
  try {
    if (monto === null) window.localStorage.removeItem(CLAVE);
    else window.localStorage.setItem(CLAVE, JSON.stringify({ monto }));
    return true;
  } catch {
    return false;
  }
}

export type Avance = {
  fraccion: number;
  queda: number;
  estado: "bien" | "cerca" | "pasado";
};

export function avancePresupuesto(gastado: number, presupuesto: number): Avance {
  const fraccion = presupuesto > 0 ? gastado / presupuesto : 0;
  return {
    fraccion,
    queda: Math.round((presupuesto - gastado) * 100) / 100,
    estado: fraccion > 1 ? "pasado" : fraccion >= AVISO_PRESUPUESTO ? "cerca" : "bien",
  };
}
