import { NavLink } from "react-router";
import { useLista } from "../contexto/lista";

/*
  El acceso a Tu lista del encabezado (openspec lista-a-mano): el changuito con
  la cantidad de productos. Se ve siempre, tambien con la lista vacia, porque
  lo que faltaba era que la lista se descubriera.
*/
function AccesoLista() {
  const { lista } = useLista();
  const n = lista.length;
  return (
    <NavLink
      to="/lista"
      aria-label={n === 0 ? "Tu lista, vacía" : `Tu lista, ${n} ${n === 1 ? "producto" : "productos"}`}
      className={({ isActive }) =>
        [
          "relative shrink-0 flex items-center gap-1.5 h-10 rounded-full px-2.5 sm:px-3.5 text-sm font-semibold transition-colors",
          isActive ? "bg-marca text-white" : "text-tinta-media hover:text-marca hover:bg-marca-tenue",
        ].join(" ")
      }
    >
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M1.5 2.5h2.6l1 4.2m0 0L7.4 15h10.2l2.9-8.3H5.1z" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="9" cy="19.5" r="1.8" fill="currentColor" />
        <circle cx="16.5" cy="19.5" r="1.8" fill="currentColor" />
      </svg>
      <span className="hidden sm:inline">Lista</span>
      {n > 0 && (
        <span
          aria-hidden="true"
          className="absolute -top-0.5 -right-0.5 sm:static min-w-5 h-5 px-1 rounded-full bg-ahorro text-white text-[11px] font-bold leading-5 text-center numero"
        >
          {n}
        </span>
      )}
    </NavLink>
  );
}

export default AccesoLista;
