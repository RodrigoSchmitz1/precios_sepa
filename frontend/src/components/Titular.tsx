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
    <header className="mb-10 bg-tinta mx-[calc(50%-50vw)] px-5 py-10 sm:py-16">
      <div className="max-w-4xl mx-auto">
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-sobre-oscuro-barato mb-4">
        {antetitulo}
      </p>
      {/*
        Mas grande que antes (hasta 7xl contra 6xl) y con el interlineado mas
        cerrado: sobre un campo oscuro el texto aguanta mas cuerpo sin gritar,
        porque el fondo ya hace el trabajo de separar la pieza del resto.
      */}
      <h1 className="font-display text-4xl sm:text-6xl lg:text-7xl leading-[0.98] text-papel max-w-3xl text-balance">
        {children}
      </h1>
      {bajada && (
        <div className="mt-5 text-sm leading-relaxed text-papel/70 max-w-2xl border-t border-papel/15 pt-4">
          {bajada}
        </div>
      )}
      </div>
    </header>
  );
}

export default Titular;
