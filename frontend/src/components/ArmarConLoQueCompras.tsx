import { useState } from "react";
import { useLista } from "../contexto/lista";
import { compraHabitual } from "../utils/compraHabitual";
import { hoyEnArgentina, leerGastos } from "../utils/gastos";

/*
  "Armarla con lo que comprás" (openspec app-para-el-usuario): Mi compra se
  llena con la compra habitual de Mis gastos -los productos que se repiten en
  tus tickets, con su cantidad tipica-, la misma regla que usa Mis gastos. Es
  parte de lo que gana el usuario por cargar tickets. Sin compra habitual no
  aparece. Todo sale de los tickets guardados en el telefono.
*/
function ArmarConLoQueCompras() {
  const { lista, sumar } = useLista();
  const [habitual] = useState(() => compraHabitual(leerGastos(), hoyEnArgentina()));
  const [sumados, setSumados] = useState<number | null>(null);
  if (habitual.length === 0) return null;
  const faltan = habitual.filter((p) => !lista.some((i) => i.id_producto === p.id_producto));
  if (faltan.length === 0 && sumados === null) return null;
  return (
    <section className="tarjeta p-4 sm:p-5 mb-6 flex flex-wrap items-center justify-between gap-3" aria-label="Armarla con lo que comprás">
      <p className="text-sm text-tinta min-w-0">
        {sumados !== null ? (
          <>Sumamos {sumados} {sumados === 1 ? "producto" : "productos"} que comprás seguido.</>
        ) : (
          <>
            <strong>Tus tickets ya saben qué comprás.</strong> Hay {faltan.length}{" "}
            {faltan.length === 1 ? "producto que se repite" : "productos que se repiten"} y no están en tu lista.
          </>
        )}
      </p>
      {faltan.length > 0 && (
        <button
          type="button"
          onClick={() => {
            sumar(faltan.map((p) => ({ id_producto: p.id_producto, nombre: p.descripcion, cantidad: p.cantidad })));
            setSumados(faltan.length);
          }}
          className="shrink-0 rounded-xl fondo-marca text-white text-sm font-bold px-4 py-2.5 min-h-11"
        >
          Armarla con lo que comprás
        </button>
      )}
    </section>
  );
}

export default ArmarConLoQueCompras;
