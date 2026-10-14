import { useEffect, useState } from "react";
import { Link } from "react-router";
import EmpezarConCanastaBasica from "../components/EmpezarConCanastaBasica";
import {
  LUGARES_DE_COMPRA,
  categoriasFueraDelSuper,
  type LugarDeCompra,
} from "../utils/fueraDelSuper";
import {
  interpretarCanasta,
  calcularCanastaPersonalizada,
  buscarLocalidades,
  obtenerCategoriasCanasta,
} from "../api/client";
import type {
  ItemCanastaIA,
  ResultadoCanastaPersonalizada,
  LocalidadOpcion,
  CategoriaCanasta,
} from "../types";
import { nombreProvincia } from "../utils/provincias";
import { formatearPesos } from "../utils/formato";
import ItemCanastaEditable from "../components/ItemCanastaEditable";
import AgregarCategoria from "../components/AgregarCategoria";
import Titular, { Resaltado } from "../components/Titular";
import FilaDeCifras from "../components/FilaDeCifras";
import DondeComprarla from "../components/DondeComprarla";
import CanastaPorCadena from "../components/CanastaPorCadena";
import {
  canastaAUrl,
  canastaDesdeUrl,
  guardarEnNavegador,
  leerDelNavegador,
  borrarDelNavegador,
  PARAMETRO_URL,
} from "../utils/canastaGuardada";
import type { CanastaGuardada } from "../utils/canastaGuardada";
import { nombreCategoria, nombreGama } from "../utils/nombres";

/*
  Perfiles de ejemplo, como tarjetas: un titulo dicho como lo diria una persona
  y la descripcion completa a la vista, que es lo que se carga en el cuadro.
  Hasta el 2026-09-24 eran botones con la descripcion cortada a 38 letras, y
  despues con un rotulo ("Carne, huevos y mate") y la descripcion solo al pasar
  el mouse, que en el celular no existe.

  Describen solo que come y toma cada hogar, sin hablar de presupuesto ni de
  quien es la persona: "jubilados, presupuesto ajustado" podia leerse como un
  juicio. La gama se elige despues, y si no se dice nada la IA usa economica.
  Cada uno toca algo distinto de la canasta: cantidad de personas, bebe, dieta
  sin carne, mucha carne, alcohol, comida hecha. 2026-10-14: textos mas
  concretos (la merienda de los chicos, los chorizos del asado, la gaseosa de
  quien no cocina), que la IA convierte en categorias y que se leen como una
  casa real; "Soy vegetariano" paso a "Sin carne", que no asume genero.
*/
const EJEMPLOS = [
  {
    titulo: "Familia con dos chicos",
    icono: "👨‍👩‍👧‍👦",
    texto:
      "Somos cuatro: dos adultos y dos chicos que van al colegio. Comemos carne o pollo casi todos los días, tomamos mate y mucha leche, y siempre hay galletitas y jugo para la merienda",
  },
  {
    titulo: "Con un bebé en casa",
    icono: "👶",
    texto:
      "Somos dos adultos y un bebé de un año. Compramos pañales y toallitas, mucha leche y yogur, y cocinamos en casa todos los días",
  },
  {
    titulo: "Sin carne",
    icono: "🥦",
    texto:
      "No como carne: muchas verduras y frutas, legumbres, arroz, huevos y queso. Cocino en casa casi todos los días",
  },
  {
    titulo: "Carne y mate todos los días",
    icono: "🧉",
    texto: "Vivo solo. Como carne casi todos los días y muchos huevos, y el mate no falta: yerba de sobra y algo de azúcar",
  },
  {
    titulo: "Asado los fines de semana",
    icono: "🔥",
    texto:
      "Somos una pareja. En la semana cocinamos en casa y los fines de semana hacemos asado con amigos: carne, chorizos, pan, ensalada, cerveza y vino",
  },
  {
    titulo: "Cocino poco",
    icono: "🍕",
    texto: "Vivo solo y casi no cocino: congelados, fideos, panchos, hamburguesas, pizza y gaseosa",
  },
];

/*
  Identifica el estado exacto que produjo un resultado. Si el usuario edita una
  cantidad o una zona despues de calcular, el importe en pantalla deja de
  corresponder a la canasta que esta viendo: comparando firmas se detecta y se
  marca como desactualizado en vez de mostrar un numero que ya no es cierto.
*/
function firmaDe(items: ItemCanastaIA[], localidades: LocalidadOpcion[]): string {
  return JSON.stringify({
    i: items.map((i) => `${i.categoria}|${i.cantidad}|${i.unidad}|${i.gama}`).sort(),
    l: localidades.map((l) => `${l.localidad}|${l.provincia}`).sort(),
  });
}

/*
  Se resuelve el estado inicial de forma sincrona, en el primer render, y no
  dentro de un useEffect. Hacerlo en un efecto tenia un bug real: la hidratacion
  consume el parametro de la URL y lo borra de la barra de direcciones, asi que
  no es idempotente, y en desarrollo StrictMode invoca los efectos dos veces. La
  segunda pasada ya no encontraba el parametro, caia a localStorage (que para
  entonces tenia el objeto vacio recien escrito por el guardado automatico) y
  pisaba la canasta que acababa de hidratar. Resolverlo en el inicializador
  perezoso de useState elimina la clase entera de problema.

  La URL gana sobre localStorage: si alguien abre un link compartido, quiere ver
  ESA canasta y no la que tenia guardada de antes.
*/
function estadoInicial(): CanastaGuardada {
  const compartida = canastaDesdeUrl(window.location.search);
  const guardada = compartida ?? leerDelNavegador();
  return guardada ?? { descripcion: "", items: [], localidades: [] };
}

/*
  "Fuera del super compro": en el paso 1 y no en el 2, que solo aparece con la
  canasta ya armada y hacia que los botones no se vieran al entrar. Muy comun:
  la carne en la carniceria y la verdura en la verduleria, y todo lo demas
  (yerba, galletitas, queso, limpieza) en el super. SEPA solo tiene precios de
  supermercado, asi que eso se aparta de la cotizacion.
*/
function LugaresDeCompra({
  elegidos,
  onAlternar,
}: {
  elegidos: LugarDeCompra[];
  onAlternar: (lugar: LugarDeCompra) => void;
}) {
  /*
    2026-10-14: de dos pastillitas de texto chico a dos tarjetas con icono y un
    interruptor. Eran faciles de pasar por alto y dificiles de tocar en el
    celular, y es una decision que cambia mucho el total: sin la carne, la
    canasta de una familia baja a la mitad.
  */
  return (
    <fieldset className="mt-5">
      <legend className="text-sm font-bold text-tinta mb-2">¿Comprás algo fuera del súper?</legend>
      <div className="grid sm:grid-cols-2 gap-3">
        {(Object.keys(LUGARES_DE_COMPRA) as LugarDeCompra[]).map((lugar) => {
          const marcado = elegidos.includes(lugar);
          const datos = LUGARES_DE_COMPRA[lugar];
          return (
            <button
              key={lugar}
              type="button"
              role="switch"
              aria-checked={marcado}
              onClick={() => onAlternar(lugar)}
              className={`flex items-center gap-3 text-left rounded-2xl px-4 py-3.5 transition ${
                marcado ? "bg-marca-tenue ring-2 ring-marca" : "bg-papel shadow-tarjeta hover:shadow-flotante"
              }`}
            >
              <span aria-hidden="true" className="shrink-0 w-11 h-11 rounded-xl bg-papel-hundido grid place-items-center text-2xl">
                {datos.icono}
              </span>
              <span className="flex-1 min-w-0">
                <span className={`block text-sm font-bold ${marcado ? "text-marca" : "text-tinta"}`}>{datos.etiqueta}</span>
                <span className="block text-xs text-tinta-media mt-0.5">
                  {marcado ? `Listo: no se suman ${datos.detalle}` : `Tocá y no se suman ${datos.detalle}`}
                </span>
              </span>
              {/* El interruptor: dice "si o no" sin tener que leer el texto. */}
              <span
                aria-hidden="true"
                className={`shrink-0 w-11 h-6 rounded-full p-0.5 transition-colors ${marcado ? "bg-marca" : "bg-linea-fuerte"}`}
              >
                <span
                  className={`block w-5 h-5 rounded-full bg-white shadow transition-transform ${marcado ? "translate-x-5" : ""}`}
                />
              </span>
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

function CanastaPersonalizadaPage() {
  const [inicial] = useState(estadoInicial);
  const [descripcion, setDescripcion] = useState(inicial.descripcion);
  const [items, setItems] = useState<ItemCanastaIA[]>(inicial.items);
  const [fueraDelSuper, setFueraDelSuper] = useState<LugarDeCompra[]>(inicial.fueraDelSuper ?? []);
  const [quitados, setQuitados] = useState<ItemCanastaIA[]>([]);
  const [generando, setGenerando] = useState(false);
  const [errorGenerar, setErrorGenerar] = useState<string | null>(null);

  const [busquedaLocalidad, setBusquedaLocalidad] = useState("");
  const [opcionesLocalidad, setOpcionesLocalidad] = useState<LocalidadOpcion[]>([]);
  // Se guarda la provincia junto al nombre: hay localidades homonimas en
  // provincias distintas (Cordoba en AR-C y AR-X) y sin ese dato el calculo
  // mezclaba las dos.
  const [localidadesElegidas, setLocalidadesElegidas] =
    useState<LocalidadOpcion[]>(inicial.localidades);

  const [resultado, setResultado] = useState<ResultadoCanastaPersonalizada | null>(null);
  const [firmaResultado, setFirmaResultado] = useState<string | null>(null);
  const [calculando, setCalculando] = useState(false);
  const [errorCalcular, setErrorCalcular] = useState<string | null>(null);
  const [linkCopiado, setLinkCopiado] = useState(false);
  // Catalogo para agregar categorias a mano. Si no carga, el buscador no se
  // muestra: la canasta con IA sigue funcionando igual.
  const [catalogo, setCatalogo] = useState<CategoriaCanasta[]>([]);

  useEffect(() => {
    let cancelado = false;
    obtenerCategoriasCanasta()
      .then((lista) => {
        if (!cancelado) setCatalogo(lista);
      })
      .catch(() => {});
    return () => {
      cancelado = true;
    };
  }, []);

  /*
    Se saca el parametro de la barra de direcciones una vez consumido: en cuanto
    el usuario edite algo, esa URL dejaria de representar lo que tiene en
    pantalla. Para volver a compartir se genera un link nuevo con el boton.
    Limpiar una URL ya limpia no hace nada, asi que es seguro que corra de mas.
  */
  useEffect(() => {
    if (window.location.search.includes(`${PARAMETRO_URL}=`)) {
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  useEffect(() => {
    // No se persiste el estado vacio: evita dejar una entrada inutil en el
    // storage de alguien que solo pasa por la pagina, y hace que "empezar de
    // nuevo" realmente deje limpio el navegador.
    if (!descripcion.trim() && items.length === 0 && localidadesElegidas.length === 0) return;
    guardarEnNavegador({ descripcion, items, localidades: localidadesElegidas, fueraDelSuper });
  }, [descripcion, items, localidadesElegidas, fueraDelSuper]);

  function handleGenerar() {
    if (!descripcion.trim()) return;
    setGenerando(true);
    setErrorGenerar(null);
    setResultado(null);
    setFirmaResultado(null);
    setQuitados([]);
    interpretarCanasta(descripcion)
      .then((r) => {
        setItems(r.items);
        setGenerando(false);
      })
      .catch((err) => {
        setErrorGenerar(err.message);
        setGenerando(false);
      });
  }

  function cargarCanastaBasica(basica: ItemCanastaIA[]) {
    setItems(basica);
    setQuitados([]);
    setResultado(null);
    setFirmaResultado(null);
    setErrorGenerar(null);
  }

  function handleBuscarLocalidad(texto: string) {
    setBusquedaLocalidad(texto);
    if (texto.trim().length < 3) {
      setOpcionesLocalidad([]);
      return;
    }
    buscarLocalidades(texto).then(setOpcionesLocalidad).catch(() => setOpcionesLocalidad([]));
  }

  function agregarLocalidad(opcion: LocalidadOpcion) {
    const yaEsta = localidadesElegidas.some(
      (l) => l.localidad === opcion.localidad && l.provincia === opcion.provincia
    );
    if (!yaEsta && localidadesElegidas.length < 3) {
      setLocalidadesElegidas([...localidadesElegidas, opcion]);
    }
    setBusquedaLocalidad("");
    setOpcionesLocalidad([]);
  }

  function quitarLocalidad(opcion: LocalidadOpcion) {
    setLocalidadesElegidas(
      localidadesElegidas.filter(
        (l) => !(l.localidad === opcion.localidad && l.provincia === opcion.provincia)
      )
    );
  }

  function cambiarCantidad(categoria: string, cantidad: number) {
    if (!Number.isFinite(cantidad) || cantidad <= 0) return;
    setItems(items.map((i) => (i.categoria === categoria ? { ...i, cantidad } : i)));
  }

  function cambiarGama(categoria: string, gama: string) {
    setItems(items.map((i) => (i.categoria === categoria ? { ...i, gama } : i)));
  }

  function quitarItem(categoria: string) {
    const item = items.find((i) => i.categoria === categoria);
    if (item) setQuitados([...quitados, item]);
    setItems(items.filter((i) => i.categoria !== categoria));
  }

  function restaurarItem(categoria: string) {
    const item = quitados.find((i) => i.categoria === categoria);
    if (!item) return;
    setQuitados(quitados.filter((i) => i.categoria !== categoria));
    setItems([...items, item]);
  }

  function agregarCategoria(categoria: CategoriaCanasta) {
    if (items.some((i) => i.categoria === categoria.categoria)) return;
    setItems([
      ...items,
      {
        categoria: categoria.categoria,
        cantidad: categoria.cantidad_sugerida,
        unidad: categoria.unidad,
        gama: "economico",
        razon: "Agregada por vos",
      },
    ]);
    // Si estaba entre las quitadas, deja de ofrecerse para restaurar: ya volvio.
    setQuitados(quitados.filter((q) => q.categoria !== categoria.categoria));
  }

  function handleCalcular() {
    if (cotizables.length === 0 || localidadesElegidas.length === 0) return;
    setCalculando(true);
    setErrorCalcular(null);
    const firma = firmaDe(cotizables, localidadesElegidas);
    calcularCanastaPersonalizada(cotizables, localidadesElegidas)
      .then((r) => {
        setResultado(r);
        setFirmaResultado(firma);
        setCalculando(false);
      })
      .catch((err) => {
        setErrorCalcular(err.message);
        setCalculando(false);
      });
  }

  async function copiarLink() {
    const url = canastaAUrl(
      { descripcion, items, localidades: localidadesElegidas, fueraDelSuper },
      window.location.href
    );
    try {
      await navigator.clipboard.writeText(url);
      setLinkCopiado(true);
      window.setTimeout(() => setLinkCopiado(false), 2500);
    } catch {
      // Algunos navegadores niegan el portapapeles sin gesto directo o fuera de
      // https. Mostrar la URL deja al usuario copiarla a mano.
      window.prompt("Copiá este link para volver a tu canasta:", url);
    }
  }

  function empezarDeNuevo() {
    setDescripcion("");
    setItems([]);
    setQuitados([]);
    setFueraDelSuper([]);
    setLocalidadesElegidas([]);
    setResultado(null);
    setFirmaResultado(null);
    setErrorGenerar(null);
    setErrorCalcular(null);
    borrarDelNavegador();
  }

  const disponibles = catalogo.filter((c) => !items.some((i) => i.categoria === c.categoria));

  // Lo que se compra fuera del super queda en la canasta pero no se cotiza: al
  // desmarcar el lugar vuelve con la cantidad y la gama que tenia.
  const fuera = categoriasFueraDelSuper(fueraDelSuper);
  const cotizables = items.filter((i) => !fuera.has(i.categoria));
  const apartados = items.filter((i) => fuera.has(i.categoria));

  function alternarLugar(lugar: LugarDeCompra) {
    setFueraDelSuper(
      fueraDelSuper.includes(lugar) ? fueraDelSuper.filter((l) => l !== lugar) : [...fueraDelSuper, lugar]
    );
  }

  const resultadoVigente =
    resultado !== null && firmaResultado === firmaDe(cotizables, localidadesElegidas);

  // Categorias que se pidieron pero el mart no pudo cotizar en esa zona (no hay
  // suficientes muestras para esa combinacion de categoria, gama y unidad).
  // Solo tiene sentido mostrarlas mientras el resultado corresponda a la canasta
  // actual; si esta desactualizado, la comparacion no significa nada.
  const provinciales = resultado?.categorias_provinciales ?? 0;

  const sinCotizar = resultadoVigente
    ? cotizables.filter((i) => !resultado!.items.some((r) => r.categoria === i.categoria))
    : [];

  return (
    <div className="max-w-3xl mx-auto">
      <Titular
        antetitulo={
          resultadoVigente && resultado
            ? `Tu canasta · ${resultado.categorias_calculadas} categorías cotizadas`
            : "Tu canasta"
        }
        bajada="Describí qué consumís y una inteligencia artificial arma tu canasta. Ajustala a mano, elegí tu zona y calculamos el costo con precios reales de supermercado."
      >
        {resultadoVigente && resultado ? (
          <>
            Tu canasta cuesta{" "}
            <Resaltado tono="barato">{formatearPesos(resultado.costo_total)}</Resaltado> por mes
            {localidadesElegidas.length === 1 && ` en ${localidadesElegidas[0].localidad}`}
          </>
        ) : (
          "Contá qué consumís y te decimos cuánto te cuesta"
        )}
      </Titular>

      {/* Paso 1 */}
      <section className="mb-8">
        <h2 className="font-display text-xl text-tinta mb-3">
          <span aria-hidden="true" className="inline-grid place-items-center w-7 h-7 rounded-full fondo-marca text-white text-sm font-extrabold mr-2 align-middle">1</span>Contá qué consumís
        </h2>
        <textarea
          value={descripcion}
          onChange={(e) => setDescripcion(e.target.value)}
          placeholder="Ej: somos una familia de 4, dos adultos y dos chicos, comemos bastante carne y pollo y tomamos mate"
          rows={3}
          className="w-full bg-papel rounded-2xl shadow-tarjeta px-4 py-3.5 text-base leading-relaxed resize-y focus:outline-none focus:ring-2 focus:ring-marca/40"
        />

        {items.length === 0 && !generando && (
          <div className="mt-3">
            <p className="text-xs text-tinta-suave mb-2">O elegí uno parecido a tu casa y ajustalo:</p>
            {/* En el celular, una fila que se desliza: apiladas, las seis median
                612 px y empujaban el boton de generar fuera de la pantalla. */}
            <div className="flex gap-2 overflow-x-auto snap-x snap-mandatory pb-1 -mx-1 px-1 sm:grid sm:grid-cols-2 sm:overflow-visible sm:mx-0 sm:px-0">
              {EJEMPLOS.map((ejemplo) => {
                const elegido = descripcion === ejemplo.texto;
                return (
                  <button
                    key={ejemplo.titulo}
                    type="button"
                    aria-pressed={elegido}
                    onClick={() => setDescripcion(ejemplo.texto)}
                    className={`flex gap-3 text-left rounded-2xl px-3.5 py-3 transition shrink-0 w-72 snap-start sm:w-auto ${
                      elegido
                        ? "bg-marca-tenue ring-2 ring-marca"
                        : "bg-papel shadow-tarjeta hover:-translate-y-0.5 hover:shadow-flotante"
                    }`}
                  >
                    <span aria-hidden="true" className="shrink-0 w-11 h-11 rounded-xl bg-papel-hundido grid place-items-center text-2xl">
                      {ejemplo.icono}
                    </span>
                    <span className="min-w-0">
                      <span className={`block text-sm font-bold ${elegido ? "text-marca" : "text-tinta"}`}>
                        {ejemplo.titulo}
                      </span>
                      <span className="block text-xs text-tinta-media mt-0.5 leading-relaxed">{ejemplo.texto}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <LugaresDeCompra elegidos={fueraDelSuper} onAlternar={alternarLugar} />

        <button
          onClick={handleGenerar}
          disabled={generando || !descripcion.trim()}
          className="mt-4 fondo-marca text-white text-sm font-bold px-5 py-2.5 rounded-xl shadow-[0_6px_16px_rgb(91_61_245/0.3)] hover:brightness-110 disabled:bg-linea-fuerte disabled:cursor-not-allowed transition-colors"
        >
          {generando ? "Armando tu canasta…" : items.length > 0 ? "Volver a generar" : "Generar canasta"}
        </button>

        {errorGenerar && (
          <p className="mt-3 text-sm text-alerta bg-alerta-tenue border border-alerta/20 rounded-lg px-3 py-2">
            No se pudo generar la canasta: {errorGenerar}
          </p>
        )}

        {items.length === 0 && !generando && <EmpezarConCanastaBasica onCargar={cargarCanastaBasica} />}

        {/*
          Armarla a mano, sin la IA: con la primera categoria agregada aparecen
          los pasos siguientes, igual que despues de generar.
        */}
        {items.length === 0 && !generando && disponibles.length > 0 && (
          <div className="mt-6 pt-5 border-t border-linea">
            <AgregarCategoria
              categorias={disponibles}
              onAgregar={agregarCategoria}
              etiqueta="¿Preferís armarla vos? Agregá las categorías que comprás"
            />
          </div>
        )}
      </section>

      {items.length > 0 && (
        <>
          {/* Paso 2 */}
          <section className="mb-8">
            <div className="flex items-baseline justify-between gap-3 mb-3">
              <h2 className="font-display text-xl text-tinta">
                <span aria-hidden="true" className="inline-grid place-items-center w-7 h-7 rounded-full fondo-marca text-white text-sm font-extrabold mr-2 align-middle">2</span>Ajustala a tu gusto
              </h2>
              <span className="text-xs text-tinta-suave">
                {cotizables.length} {cotizables.length === 1 ? "categoría" : "categorías"}
                {apartados.length > 0 && ` · ${apartados.length} aparte`}
              </span>
            </div>

            {apartados.length > 0 && (
              <p className="mb-3 text-xs text-tinta-media bg-papel-hundido rounded-lg px-3 py-2 leading-relaxed">
                {fueraDelSuper
                  .map((lugar) => {
                    const cats = apartados.filter((i) =>
                      (LUGARES_DE_COMPRA[lugar].categorias as readonly string[]).includes(i.categoria)
                    );
                    return cats.length
                      ? `${cats.map((i) => nombreCategoria(i.categoria)).join(", ")}: en ${LUGARES_DE_COMPRA[lugar].lugar}`
                      : null;
                  })
                  .filter(Boolean)
                  .join(". ")}
                . No se cotizan ni se suman; siguen en la canasta y vuelven si lo desmarcás.
              </p>
            )}

            <div className="grid gap-1.5">
              {cotizables.map((item) => (
                <ItemCanastaEditable
                  key={item.categoria}
                  item={item}
                  onCambiarCantidad={cambiarCantidad}
                  onCambiarGama={cambiarGama}
                  onQuitar={quitarItem}
                />
              ))}
            </div>

            {quitados.length > 0 && (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="text-xs text-tinta-suave">Quitaste:</span>
                {quitados.map((item) => (
                  <button
                    key={item.categoria}
                    onClick={() => restaurarItem(item.categoria)}
                    className="text-xs text-tinta-media bg-papel border border-linea border-dashed rounded-full px-3 py-1 hover:border-marca hover:text-marca transition-colors"
                  >
                    + {nombreCategoria(item.categoria)}
                  </button>
                ))}
              </div>
            )}

            {disponibles.length > 0 && (
              <div className="mt-4">
                <AgregarCategoria
                  categorias={disponibles}
                  onAgregar={agregarCategoria}
                  etiqueta="¿Falta algo? Agregá una categoría"
                />
              </div>
            )}
          </section>

          {/* Paso 3 */}
          <section className="mb-8">
            <h2 className="font-display text-xl text-tinta mb-3">
              <span aria-hidden="true" className="inline-grid place-items-center w-7 h-7 rounded-full fondo-marca text-white text-sm font-extrabold mr-2 align-middle">3</span>Elegí tu zona <span className="text-sm font-semibold text-tinta-suave">(hasta 3)</span>
            </h2>

            <input
              type="text"
              value={busquedaLocalidad}
              onChange={(e) => handleBuscarLocalidad(e.target.value)}
              placeholder="Buscar localidad o barrio…"
              className="w-full bg-papel rounded-2xl shadow-tarjeta px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-marca/40"
            />

            {opcionesLocalidad.length > 0 && (
              <div className="mt-1.5 bg-papel border border-linea rounded-xl overflow-hidden max-h-52 overflow-y-auto">
                {opcionesLocalidad.map((op) => (
                  <button
                    key={`${op.localidad}-${op.provincia}`}
                    onClick={() => agregarLocalidad(op)}
                    className="block w-full text-left text-sm px-4 py-2.5 hover:bg-papel-hundido border-b border-linea last:border-0 transition-colors"
                  >
                    {op.localidad}
                    <span className="text-tinta-suave"> — {nombreProvincia(op.provincia)}</span>
                  </button>
                ))}
              </div>
            )}

            {localidadesElegidas.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-3">
                {localidadesElegidas.map((loc) => (
                  <span
                    key={`${loc.localidad}-${loc.provincia}`}
                    className="inline-flex items-center gap-1.5 bg-marca-tenue text-marca border border-marca-borde text-xs font-medium pl-3 pr-2 py-1.5 rounded-full"
                  >
                    {loc.localidad}
                    <span className="font-normal opacity-70">{nombreProvincia(loc.provincia)}</span>
                    <button
                      onClick={() => quitarLocalidad(loc)}
                      aria-label={`Quitar ${loc.localidad}`}
                      className="hover:text-marca-hover"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}

            <button
              onClick={handleCalcular}
              disabled={calculando || localidadesElegidas.length === 0 || cotizables.length === 0}
              className="mt-4 fondo-marca text-white text-sm font-bold px-5 py-2.5 rounded-xl shadow-[0_6px_16px_rgb(91_61_245/0.3)] hover:brightness-110 disabled:bg-linea-fuerte disabled:cursor-not-allowed transition-colors"
            >
              {calculando ? "Calculando…" : resultado ? "Recalcular costo" : "Calcular costo"}
            </button>

            {localidadesElegidas.length === 0 && (
              <p className="mt-2 text-xs text-tinta-suave">
                Elegí al menos una localidad para poder calcular.
              </p>
            )}

            {errorCalcular && (
              <p className="mt-3 text-sm text-alerta bg-alerta-tenue border border-alerta/20 rounded-lg px-3 py-2">
                No se pudo calcular: {errorCalcular}
              </p>
            )}
          </section>
        </>
      )}

      {resultado && (
        <section
          className={[
            "bg-papel border rounded-2xl p-6 transition-opacity",
            resultadoVigente ? "border-marca-borde" : "border-linea opacity-60",
          ].join(" ")}
        >
          {!resultadoVigente && (
            <p className="text-xs text-aviso bg-aviso-tenue border border-aviso/20 rounded-lg px-3 py-2 mb-4">
              Cambiaste la canasta después de calcular. Volvé a calcular para ver el costo real.
            </p>
          )}

          {/* El total va en el titular de la pagina; aca quedan las cifras que
              lo ponen en contexto, sin repetir el mismo numero dos veces. */}
          <div className="mb-5">
            <FilaDeCifras
              cifras={[
                {
                  etiqueta: "Costo mensual",
                  valor: formatearPesos(resultado.costo_total),
                  detalle: provinciales > 0 ? "con precios de tu zona y tu provincia" : "con precios de tu zona",
                },
                {
                  etiqueta: "Por día",
                  valor: formatearPesos(resultado.costo_total / 30),
                  detalle: "promedio del mes",
                },
                {
                  etiqueta: "Categorías",
                  valor: `${resultado.categorias_calculadas} de ${resultado.categorias_pedidas}`,
                  detalle:
                    provinciales > 0
                      ? `${provinciales} con precio de la provincia`
                      : "cotizadas con datos",
                },
                // Con una sola zona ya la dice el titulo ("... por mes en Palermo"),
                // y como cuarta cifra no entraba: el costo por dia salia cortado.
                ...(localidadesElegidas.length > 1
                  ? [
                      {
                        etiqueta: localidadesElegidas.length === 1 ? "Zona" : "Zonas",
                        valor: localidadesElegidas.map((l) => l.localidad).join(", "),
                        detalle: localidadesElegidas.length === 1 ? "elegida por vos" : "elegidas por vos",
                      },
                    ]
                  : []),
              ]}
            />
          </div>

          {/*
            Desglose ordenado de mayor a menor con barra proporcional: la lista
            suelta no dejaba ver en que se va la plata, que es la pregunta que
            trae a alguien a armar una canasta.
          */}
          <div className="border-t border-linea pt-4 space-y-2.5">
            {[...resultado.items]
              .sort((a, b) => b.costo_categoria - a.costo_categoria)
              .map((item) => {
                const parte =
                  resultado.costo_total > 0 ? item.costo_categoria / resultado.costo_total : 0;
                return (
                  <div key={item.categoria}>
                    <div className="flex justify-between items-baseline gap-4 text-sm mb-1">
                      <span className="text-tinta-media">
                        {nombreCategoria(item.categoria)}
                        <span className="text-tinta-suave text-xs">
                          {" "}
                          {item.cantidad} {item.unidad} · {nombreGama(item.gama)}
                        </span>
                        {/* Marcado y no escondido: el total incluye un precio que
                            no es de la zona elegida, y quien lo lee tiene que
                            poder saberlo. */}
                        {item.origen_precio === "provincia" && (
                          <span
                            className="text-aviso text-xs"
                            title="Tu zona no tiene datos suficientes de esta categoría: se usa el precio de tu provincia."
                          >
                            {" "}
                            · precio de la provincia
                          </span>
                        )}
                      </span>
                      <span className="shrink-0">
                        <span className="numero text-tinta font-medium">
                          {formatearPesos(item.costo_categoria)}
                        </span>
                        <span className="numero text-xs text-tinta-suave">
                          {" "}
                          {(parte * 100).toFixed(0)}%
                        </span>
                      </span>
                    </div>
                    <div className="h-1.5 bg-papel-hundido rounded-full">
                      <div
                        className="h-1.5 rounded-full bg-escala-3"
                        style={{ width: `${parte * 100}%` }}
                        role="presentation"
                      />
                    </div>
                  </div>
                );
              })}
          </div>

          {/*
            SEPA solo informa supermercados. Mucha gente compra la carne en la
            carniceria y la verdura en la verduleria, y ahi los precios son
            otros: se dice, y se ofrece la salida (sacarlas, o contarlo en la
            descripcion, que la IA ya entiende).
          */}
          <p className="mt-5 text-xs text-tinta-suave leading-relaxed">
            Son precios de supermercado. Si la carne o la verdura las comprás en la carnicería o la verdulería,
            sacalas de la lista o contalo en la descripción y no se van a sumar.
          </p>

          {sinCotizar.length > 0 && (
            <div className="mt-5 pt-4 border-t border-linea">
              <p className="text-xs text-aviso mb-1.5">
                Sin datos suficientes en tu zona ni en tu provincia, no entraron al total:
              </p>
              <p className="text-xs text-tinta-media">
                {sinCotizar.map((i) => `${nombreCategoria(i.categoria)} (${nombreGama(i.gama)})`).join(" · ")}
              </p>
              <p className="text-xs text-tinta-suave mt-1.5">
                Probá cambiando la gama: puede haber precios de otra gama en esa localidad.
              </p>
            </div>
          )}
        </section>
      )}

      {/* Paso 4: donde comprarla. Aparece cuando hay canasta, sin esperar a que
          se calcule el costo: son dos preguntas distintas (cuanto sale y donde
          conviene comprarla) y la segunda se puede responder sola. */}
      {/* Tu canasta en cada super: la compra entera en un solo lugar. */}
      {cotizables.length > 0 && <CanastaPorCadena items={cotizables} localidades={localidadesElegidas} />}

      {cotizables.length > 0 && <DondeComprarla items={cotizables} />}

      {/* De tu canasta a tu lista: aca se cotizan categorias; en El mismo
          producto se elige la marca exacta de cada una. */}
      {cotizables.length > 0 && (
        <Link
          to="/mismo-producto"
          className="group mt-6 flex items-center justify-between gap-4 rounded-2xl border border-marca-borde bg-marca-tenue/40 p-4 sm:p-5 hover:bg-marca-tenue transition-colors"
        >
          <span>
            <span className="block font-display text-xl text-tinta mb-1">¿Ya sabés qué marcas comprás?</span>
            <span className="block text-sm text-tinta-media leading-relaxed">
              Elegí la marca exacta de cada cosa y mirá en qué cadena te sale más barata tu compra.
            </span>
          </span>
          <span className="shrink-0 text-sm font-medium text-marca group-hover:translate-x-0.5 transition-transform">
            Elegir marcas →
          </span>
        </Link>
      )}

      {/*
        Barra de sesion: la canasta se guarda sola en el navegador y el link
        permite llevarsela a otro dispositivo. Sin cuentas ni mails.
      */}
      {items.length > 0 && (
        <div className="mt-6 flex flex-wrap items-center gap-3 text-xs text-tinta-suave">
          <span className="inline-flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-marca" />
            Se guarda sola en este navegador
          </span>
          <span className="text-linea-fuerte">·</span>
          <button onClick={copiarLink} className="text-marca hover:text-marca-hover font-medium">
            {linkCopiado ? "¡Link copiado!" : "Copiar link para compartir"}
          </button>
          <span className="text-linea-fuerte">·</span>
          <button onClick={empezarDeNuevo} className="hover:text-alerta transition-colors">
            Empezar de nuevo
          </button>
        </div>
      )}
    </div>
  );
}

export default CanastaPersonalizadaPage;
