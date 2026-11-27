import { useCallback, useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import Titular from "../components/Titular";
import TuLista from "../components/TuLista";
import ArmadoRapido from "../components/ArmadoRapido";
import ListaRecibida from "../components/ListaRecibida";
import PegarLista from "../components/PegarLista";
import ArmarCompra from "../components/ArmarCompra";
import DondeComprarLista from "../components/DondeComprarLista";
import EjemploDeCompra, { BotonVerEjemplo } from "../components/EjemploDeCompra";
import ArmarConLoQueCompras from "../components/ArmarConLoQueCompras";
import BotonEscanear from "../components/BotonEscanear";
import { useLista } from "../contexto/lista";
import { listaDelLink } from "../utils/lista";

/*
  Tu lista en su pagina (openspec lista-a-mano). Antes vivia solo al fondo de
  Mismo producto, en una seccion que no se llamaba "lista". Aca se consulta;
  en Mismo producto se sigue armando.
*/
function ListaPage() {
  const { lista, cambiarCantidad, quitar, vaciar, esEjemplo } = useLista();
  const navegar = useNavigate();
  const [texto, setTexto] = useState("");
  // Si se entro con la lista vacia, el armado rapido queda abierto toda la
  // visita: al sumar el primer basico la pagina pasa a "con productos", y
  // plegarlo ahi escondia los demas justo cuando se estaba armando la lista.
  const [armadoAbierto] = useState(lista.length === 0);
  // La compra de ejemplo llega un momento despues de abrir con la lista vacia
  // (ejemplo-para-empezar): si se vio, el armado rapido no va arriba ni
  // aparece de golpe cuando la lista pasa a ser propia.
  const [vioEjemplo, setVioEjemplo] = useState(esEjemplo);
  if (esEjemplo && !vioEjemplo) setVioEjemplo(true);
  const armadoArriba = lista.length === 0 || (armadoAbierto && !vioEjemplo);
  // Una lista compartida por link (openspec compartir-y-pegar-la-lista). Se lee
  // una vez; al resolverla se saca "l" de la URL, asi recargar no repite la
  // pregunta.
  const [parametros, setParametros] = useSearchParams();
  const [recibidos] = useState(() => listaDelLink(parametros.get("l")));
  const [recibidaAbierta, setRecibidaAbierta] = useState(recibidos.length > 0);
  const cerrarRecibida = useCallback(() => {
    setRecibidaAbierta(false);
    setParametros(
      (previos) => {
        const nuevos = new URLSearchParams(previos);
        nuevos.delete("l");
        return nuevos;
      },
      { replace: true },
    );
  }, [setParametros]);

  const buscar = (e: FormEvent) => {
    e.preventDefault();
    const consulta = texto.trim();
    if (consulta.length >= 2) navegar(`/mismo-producto?q=${encodeURIComponent(consulta)}`);
  };

  const armarCompra = <ArmarCompra onVer={(id) => navegar(`/mismo-producto?p=${encodeURIComponent(id)}`)} />;

  return (
    <div className="max-w-4xl mx-auto">
      <Titular antetitulo="Mi compra" compacto>
        {lista.length > 0 ? "Dónde te conviene la compra de siempre" : "Armá la lista de lo que comprás siempre"}
      </Titular>

      {recibidaAbierta && <ListaRecibida recibidos={recibidos} onListo={cerrarRecibida} />}
      <ArmarConLoQueCompras />

      {/* Con la lista vacia al entrar, el armado rapido va primero y queda
          arriba toda la visita: si quedara abajo de la comparacion, cada
          producto sumado empujaria los botones hacia abajo. */}
      {armadoArriba && (
        <section className="tarjeta p-5 sm:p-6 mb-10">
          {/* Lista vacia: lo primero es armarla con un toque (lista-en-el-centro). */}
          <h2 className="text-lg font-bold text-tinta mb-1">Empezá con lo de siempre</h2>
          {/* Idea de Convi (app-para-el-usuario): el ejemplo se pide, no se carga solo. */}
          {lista.length === 0 && (
            <div className="rounded-2xl bg-marca-tenue/60 p-3 mb-4 flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-tinta min-w-0">¿Querés ver cómo funciona? Armamos una compra de 12 productos comunes.</p>
              <BotonVerEjemplo />
            </div>
          )}
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
          <p className="mt-3 flex flex-wrap items-center gap-2 text-sm text-tinta-media">
            ¿Lo tenés a mano? <BotonEscanear />
          </p>
        </section>
      )}
      <EjemploDeCompra />
      {/* Con la compra de ejemplo, lo primero es cuanto sale en cada cadena: el armado por categorias va al final. */}
      {!esEjemplo && armarCompra}
      {lista.length > 0 && (
        <TuLista
          lista={lista}
          onCambiarCantidad={cambiarCantidad}
          onQuitar={quitar}
          onVaciar={vaciar}
          onVer={(id) => navegar(`/mismo-producto?p=${encodeURIComponent(id)}`)}
        />
      )}
      {lista.length > 0 && (
        <div className="-mt-6 mb-6 flex flex-wrap items-center gap-2">
          <Link to="/mismo-producto" className="inline-flex items-center gap-2 rounded-xl border border-linea-fuerte bg-papel px-4 py-2.5 min-h-11 text-sm font-bold text-tinta hover:border-marca">
            <span aria-hidden="true">🔎</span> Buscar
          </Link>
          <BotonEscanear />
        </div>
      )}
      <DondeComprarLista lista={lista} plegado />
      {lista.length > 0 && (
        <p className="-mt-6 mb-10 text-base text-tinta-media">
          ¿Y lo que ya gastaste este mes?{" "}
          <Link to="/gastos" className="font-bold text-marca underline underline-offset-2">
            Mirá Mis gastos
          </Link>
        </p>
      )}
      <details className="tarjeta p-5 sm:p-6 mb-6">
        <summary className="cursor-pointer text-base font-bold text-tinta">Pegar una lista de WhatsApp</summary>
        <div className="mt-4">
          <PegarLista />
        </div>
      </details>
      {esEjemplo && armarCompra}
      {/* Con productos al entrar, los basicos quedan plegados para no tapar la comparacion. */}
      {!armadoArriba && lista.length > 0 && (
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
