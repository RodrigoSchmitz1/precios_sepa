import type { ReactNode } from "react";

/*
  Titular de pagina: el hallazgo del dia, dicho con su cifra.

  Es la pieza que da impacto sin salir del registro sobrio. Las paginas abrian
  con un nombre de seccion ("Canasta basica") y un parrafo de metodologia, y la
  cifra que importaba quedaba en un recuadro chico entre otros tres del mismo
  tamano. En el periodismo de datos el titulo ES el dato: "La misma canasta
  cuesta 41% mas segun donde vivas". El nombre de la seccion pasa a antetitulo
  y la metodologia a la bajada, donde sigue estando para quien la busca.

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
  return <span className={tono === "caro" ? "text-alerta" : "text-ahorro"}>{children}</span>;
}

function Titular({ antetitulo, children, bajada }: Props) {
  return (
    <header className="mb-8">
      <p className="text-xs font-semibold uppercase tracking-wider text-tinta-suave mb-3">{antetitulo}</p>
      <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl leading-[1.05] text-tinta max-w-3xl text-balance">
        {children}
      </h1>
      {bajada && <div className="mt-4 text-tinta-media leading-relaxed max-w-2xl">{bajada}</div>}
    </header>
  );
}

export default Titular;
