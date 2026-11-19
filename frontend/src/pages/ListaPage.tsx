import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router";
import Titular from "../components/Titular";
import TuLista from "../components/TuLista";
import ArmadoRapido from "../components/ArmadoRapido";
import { useLista } from "../contexto/lista";

/*
  Tu lista en su pagina (openspec lista-a-mano). Antes vivia solo al fondo de
  Mismo producto, en una seccion que no se llamaba "lista". Aca se consulta;
  en Mismo producto se sigue armando.
*/
function ListaPage() {
  const { lista, cambiarCantidad, quitar, vaciar } = useLista();
  const navegar = useNavigate();
  const [texto, setTexto] = useState("");
  // Si se entro con la lista vacia, el armado rapido queda abierto toda la
  // visita: al sumar el primer basico la pagina pasa a "con productos", y
  // plegarlo ahi escondia los demas justo cuando se estaba armando la lista.
  const [armadoAbierto] = useState(lista.length === 0);

  const buscar = (e: FormEvent) => {
    e.preventDefault();
    const consulta = texto.trim();
    if (consulta.length >= 2) navegar(`/mismo-producto?q=${encodeURIComponent(consulta)}`);
  };

  return (
    <div className="max-w-4xl mx-auto">
      <Titular antetitulo="Tu lista" compacto>
        {lista.length > 0 ? "Dónde te conviene la compra de siempre" : "Armá la lista de lo que comprás siempre"}
      </Titular>

      {/* Con la lista vacia al entrar, el armado rapido va primero y queda
          arriba toda la visita: si quedara abajo de la comparacion, cada
          producto sumado empujaria los botones hacia abajo. */}
      {(armadoAbierto || lista.length === 0) && (
        <section className="tarjeta p-5 sm:p-6 mb-10">
          {/* Lista vacia: lo primero es armarla con un toque (lista-en-el-centro). */}
          <h2 className="text-lg font-bold text-tinta mb-1">Empezá con lo de siempre</h2>
          <p className="text-sm text-tinta-media mb-4">Tocá los productos que comprás y se suman a tu lista.</p>
          <ArmadoRapido />
          <p className="text-base text-tinta leading-relaxed mt-6">
            Buscá los productos que comprás siempre y tocá <strong>+ Lista</strong>. Acá vas a ver cuánto sale la compra
            entera en cada cadena de tu zona. La lista se guarda en este navegador.
          </p>
          <form onSubmit={buscar} className="mt-4 flex items-center gap-2 bg-papel rounded-2xl p-1.5 pl-4 shadow-flotante">
            <span aria-hidden="true" className="text-lg">
              🔍
            </span>
            <input
              type="search"
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              placeholder="Buscá un producto: yerba, aceite, leche…"
              aria-label="Buscar un producto"
              className="flex-1 min-w-0 bg-transparent text-tinta text-base py-2 placeholder:text-tinta-suave focus:outline-none"
            />
            <button type="submit" className="shrink-0 fondo-marca text-white text-sm font-bold rounded-xl px-4 py-2.5">
              Buscar
            </button>
          </form>
          <p className="mt-4 text-sm text-tinta-media">
            ¿Ya armaste{" "}
            <Link to="/canasta-personalizada" className="text-marca font-medium hover:text-marca-hover">
              tu canasta
            </Link>
            ? En Mismo producto vas a ver las marcas más comunes de cada categoría para sumarlas de una.
          </p>
        </section>
      )}
      {lista.length > 0 && (
        <TuLista
          lista={lista}
          onCambiarCantidad={cambiarCantidad}
          onQuitar={quitar}
          onVaciar={vaciar}
          onVer={(id) => navegar(`/mismo-producto?p=${encodeURIComponent(id)}`)}
        />
      )}
      {/* Con productos al entrar, los basicos quedan plegados para no tapar la comparacion. */}
      {!armadoAbierto && lista.length > 0 && (
        <details className="tarjeta p-5 sm:p-6 mb-10">
          <summary className="cursor-pointer text-base font-bold text-tinta">Sumar básicos</summary>
          <div className="mt-4">
            <ArmadoRapido />
          </div>
        </details>
      )}
    </div>
  );
}

export default ListaPage;
