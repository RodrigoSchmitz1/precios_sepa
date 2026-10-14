import type { ReactNode } from "react";

/*
  Titular de pagina: el hallazgo del dia, dicho con su cifra, sobre una banda
  oscura.

  POR QUE UNA BANDA Y NO TEXTO SUELTO (2026-09-23)
  La version anterior ya ponia la cifra en el titular, que era lo correcto, pero
  toda la pagina quedaba en el mismo registro: papel claro, tinta, una linea
  fina, y un unico dato en color. Sobrio hasta el punto de no tener jerarquia:
  nada agarraba la vista al entrar. El diagnostico no era "falta color" sino
  "falta CONTRASTE": no habia ningun campo oscuro contra el cual el resto
  pudiera leerse como claro.

  La banda lo resuelve sin romper la disciplina del sistema. El color sigue
  entrando por el dato -la cifra, y solo la cifra, va en acento- pero ahora
  aparece sobre un fondo que la sostiene. Y como es el mismo componente en las
  cinco paginas, la jerarquia se arregla en todas de una vez.

  Los acentos no son los de la paleta clara: --color-alerta sobre el fondo
  oscuro da 3,26:1. Se usan los tonos sobre-oscuro, verificados en 7,7:1 y
  8,5:1 (ver index.css).

  VA A SANGRE Y NO ES UNA TARJETA (2026-09-23)
  La primera version era un rectangulo negro redondeado flotando en el lienzo, y
  se leia como un widget pegado encima de la pagina, no como parte del diseno.
  Ocupando el ancho completo la banda deja de ser un objeto y pasa a ser una
  zona: el mismo contraste, sin el efecto de cartel. El contenido sigue alineado
  con el resto de la pagina por el contenedor interno.

  El titular se arma con los datos del momento, nunca con texto fijo: una cifra
  vieja en letra grande es peor que no poner ninguna.

  2026-10-14, estilo "App": la banda deja de ser negra y pasa a ser el degrade
  de la marca, con la letra de los titulos pesada en vez de serif y dos circulos
  translucidos de fondo. El negro con serif era lo que hacia que el sitio se
  leyera "como un diario". El antetitulo pasa de versalitas a una pastilla.
*/

type Props = {
  /** Nombre de la seccion, chico y arriba. */
  antetitulo: string;
  /** El titular. Puede llevar <Resaltado> en la cifra. */
  children: ReactNode;
  bajada?: ReactNode;
};

/** La cifra del titular. El color acompana al texto, no lo reemplaza. */
export function Resaltado({ children, tono = "caro" }: { children: ReactNode; tono?: "caro" | "barato" }) {
  return (
    <span className={tono === "caro" ? "text-sobre-oscuro-caro" : "text-sobre-oscuro-barato"}>{children}</span>
  );
}

function Titular({ antetitulo, children, bajada }: Props) {
  return (
    /* A sangre y no una tarjeta: ver el comentario de arriba. */
    <header className="relative overflow-hidden mb-10 fondo-marca -mt-10 mx-[calc(50%-50vw)] px-5 pt-10 pb-12 sm:pt-14 sm:pb-16 rounded-b-[2.5rem]">
      <span aria-hidden="true" className="absolute -right-24 -top-40 w-[30rem] h-[30rem] rounded-full bg-white/[0.07]" />
      <span aria-hidden="true" className="absolute right-[18%] -bottom-40 w-72 h-72 rounded-full bg-white/[0.06]" />
      <div className="relative max-w-4xl mx-auto">
      <p className="inline-block text-xs font-bold text-white bg-white/15 rounded-full px-3 py-1 mb-4">
        {antetitulo}
      </p>
      {/*
        6xl y no 7xl (2026-09-23). Con el titular al maximo, la distancia
        contra el resto de la pagina era tanta que lo de abajo parecia chico
        aunque no lo fuera. La banda oscura ya separa la pieza del resto; el
        cuerpo no tiene que hacer ademas ese trabajo. La diferencia se cierra
        por los dos lados: el titular baja un escalon y las listas suben uno.
      */}
      <h1 className="font-display text-4xl sm:text-5xl lg:text-[3.5rem] leading-[1.05] text-white max-w-3xl text-balance">
        {children}
      </h1>
      {bajada && (
        <div className="mt-4 text-base leading-relaxed text-white/85 max-w-2xl">
          {bajada}
        </div>
      )}
      </div>
    </header>
  );
}

export default Titular;
