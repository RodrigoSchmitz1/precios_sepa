import { useEffect, useState } from "react";
import EmpezarConCanastaBasica from "../components/EmpezarConCanastaBasica";
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
import {
  canastaAUrl,
  canastaDesdeUrl,
  guardarEnNavegador,
  leerDelNavegador,
  borrarDelNavegador,
  PARAMETRO_URL,
} from "../utils/canastaGuardada";
import type { CanastaGuardada } from "../utils/canastaGuardada";

/*
  Perfiles de ejemplo: un titulo corto para el boton y la descripcion completa,
  que es lo que se carga en el cuadro. Hasta el 2026-09-24 el boton mostraba la
  descripcion cortada a 38 letras ("Somos una familia de 4, dos adultos y …") y
  no habia forma de leer el resto antes de elegirla.

  Cubren los hogares mas comunes y cada uno toca algo distinto de la canasta:
  cantidad de personas, bebe, dieta, presupuesto.
*/
const EJEMPLOS = [
  {
    titulo: "Familia de 4",
    texto: "Somos una familia de 4, dos adultos y dos chicos, comemos bastante carne y pollo, tomamos mate, presupuesto medio",
  },
  { titulo: "Vivo solo", texto: "Vivo solo, cocino poco, compro mucha fruta y verdura, no tomo gaseosa" },
  {
    titulo: "Pareja vegetariana",
    texto: "Pareja vegetariana, cocinamos todo en casa, priorizamos calidad sobre precio",
  },
  {
    titulo: "Jubilados",
    texto: "Somos una pareja de jubilados, comemos liviano, mucha verdura, lácteos y pan, tomamos mate y té, presupuesto ajustado",
  },
  {
    titulo: "Familia con bebé",
    texto: "Somos dos adultos y un bebé de un año, necesitamos pañales y leche, cocinamos en casa, presupuesto medio",
  },
  {
    titulo: "Estudiante",
    texto: "Soy estudiante y vivo solo, como mucho fideos, arroz y milanesas, tomo mate, presupuesto ajustado",
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

function CanastaPersonalizadaPage() {
  const [inicial] = useState(estadoInicial);
  const [descripcion, setDescripcion] = useState(inicial.descripcion);
  const [items, setItems] = useState<ItemCanastaIA[]>(inicial.items);
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
    guardarEnNavegador({ descripcion, items, localidades: localidadesElegidas });
  }, [descripcion, items, localidadesElegidas]);

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
    if (items.length === 0 || localidadesElegidas.length === 0) return;
    setCalculando(true);
    setErrorCalcular(null);
    const firma = firmaDe(items, localidadesElegidas);
    calcularCanastaPersonalizada(items, localidadesElegidas)
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
      { descripcion, items, localidades: localidadesElegidas },
      window.location.href
    );
    try {
      await navigator.clipboard.writeText(url);
      setLinkCopiado(true);
      window.setTimeout(() => setLinkCopiado(false), 2500);
    } catch {
      // Algunos navegadores niegan el portapapeles sin gesto directo o fuera de
      // https. Mostrar la URL deja al usuario copiarla a mano.
      window.prompt("Copia este link para volver a tu canasta:", url);
    }
  }

  function empezarDeNuevo() {
    setDescripcion("");
    setItems([]);
    setQuitados([]);
    setLocalidadesElegidas([]);
    setResultado(null);
    setFirmaResultado(null);
    setErrorGenerar(null);
    setErrorCalcular(null);
    borrarDelNavegador();
  }

  const disponibles = catalogo.filter((c) => !items.some((i) => i.categoria === c.categoria));

  const resultadoVigente =
    resultado !== null && firmaResultado === firmaDe(items, localidadesElegidas);

  // Categorias que se pidieron pero el mart no pudo cotizar en esa zona (no hay
  // suficientes muestras para esa combinacion de categoria, gama y unidad).
  // Solo tiene sentido mostrarlas mientras el resultado corresponda a la canasta
  // actual; si esta desactualizado, la comparacion no significa nada.
  const provinciales = resultado?.categorias_provinciales ?? 0;

  const sinCotizar = resultadoVigente
    ? items.filter((i) => !resultado!.items.some((r) => r.categoria === i.categoria))
    : [];

  return (
    <div className="max-w-3xl mx-auto">
      <Titular
        antetitulo={
          resultadoVigente && resultado
            ? `Tu canasta · ${resultado.categorias_calculadas} categorias cotizadas`
            : "Tu canasta"
        }
        bajada="Describi que consumis y una inteligencia artificial arma tu canasta. Ajustala a mano, elegi tu zona y calculamos el costo con precios reales de supermercado."
      >
        {resultadoVigente && resultado ? (
          <>
            Tu canasta cuesta{" "}
            <Resaltado tono="barato">{formatearPesos(resultado.costo_total)}</Resaltado> por mes
            {localidadesElegidas.length === 1 && ` en ${localidadesElegidas[0].localidad}`}
          </>
        ) : (
          "Conta que consumis y te decimos cuanto te cuesta"
        )}
      </Titular>

      {/* Paso 1 */}
      <section className="mb-8">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-tinta-suave mb-3">
          1 · Conta que consumis
        </h2>
        <textarea
          value={descripcion}
          onChange={(e) => setDescripcion(e.target.value)}
          placeholder="Ej: somos una familia de 4, dos adultos y dos chicos, comemos bastante carne y pollo, tomamos mate, presupuesto medio"
          rows={3}
          className="w-full bg-papel border border-linea rounded-xl px-4 py-3 text-sm leading-relaxed resize-y focus:outline-none focus:border-ahorro"
        />

        {items.length === 0 && !generando && (
          <div className="flex flex-wrap gap-2 mt-3">
            <span className="text-xs text-tinta-suave py-1">Probá con:</span>
            {EJEMPLOS.map((ejemplo) => (
              <button
                key={ejemplo.titulo}
                onClick={() => setDescripcion(ejemplo.texto)}
                title={ejemplo.texto}
                aria-label={`Usar el ejemplo: ${ejemplo.texto}`}
                className={`text-xs border rounded-full px-3 py-1 transition-colors ${
                  descripcion === ejemplo.texto
                    ? "text-ahorro bg-ahorro-tenue border-ahorro-borde"
                    : "text-tinta-media bg-papel border-linea hover:border-linea-fuerte hover:text-tinta"
                }`}
              >
                {ejemplo.titulo}
              </button>
            ))}
          </div>
        )}

        <button
          onClick={handleGenerar}
          disabled={generando || !descripcion.trim()}
          className="mt-4 bg-ahorro text-white text-sm font-semibold px-5 py-2.5 rounded-lg hover:bg-ahorro-hover disabled:bg-linea-fuerte disabled:cursor-not-allowed transition-colors"
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
              etiqueta="¿Preferis armarla vos? Agrega las categorias que compras"
            />
          </div>
        )}
      </section>

      {items.length > 0 && (
        <>
          {/* Paso 2 */}
          <section className="mb-8">
            <div className="flex items-baseline justify-between gap-3 mb-3">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-tinta-suave">
                2 · Ajustala a tu gusto
              </h2>
              <span className="text-xs text-tinta-suave">
                {items.length} {items.length === 1 ? "categoria" : "categorias"}
              </span>
            </div>

            <div className="grid gap-2.5">
              {items.map((item) => (
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
                    className="text-xs text-tinta-media bg-papel border border-linea border-dashed rounded-full px-3 py-1 hover:border-ahorro hover:text-ahorro transition-colors"
                  >
                    + {item.categoria}
                  </button>
                ))}
              </div>
            )}

            {disponibles.length > 0 && (
              <div className="mt-4">
                <AgregarCategoria
                  categorias={disponibles}
                  onAgregar={agregarCategoria}
                  etiqueta="¿Falta algo? Agrega una categoria"
                />
              </div>
            )}
          </section>

          {/* Paso 3 */}
          <section className="mb-8">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-tinta-suave mb-3">
              3 · Elegi tu zona <span className="normal-case font-normal">(hasta 3)</span>
            </h2>

            <input
              type="text"
              value={busquedaLocalidad}
              onChange={(e) => handleBuscarLocalidad(e.target.value)}
              placeholder="Buscar localidad o barrio…"
              className="w-full bg-papel border border-linea rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-ahorro"
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
                    className="inline-flex items-center gap-1.5 bg-ahorro-tenue text-ahorro border border-ahorro-borde text-xs font-medium pl-3 pr-2 py-1.5 rounded-full"
                  >
                    {loc.localidad}
                    <span className="font-normal opacity-70">{nombreProvincia(loc.provincia)}</span>
                    <button
                      onClick={() => quitarLocalidad(loc)}
                      aria-label={`Quitar ${loc.localidad}`}
                      className="hover:text-ahorro-hover"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}

            <button
              onClick={handleCalcular}
              disabled={calculando || localidadesElegidas.length === 0}
              className="mt-4 bg-ahorro text-white text-sm font-semibold px-5 py-2.5 rounded-lg hover:bg-ahorro-hover disabled:bg-linea-fuerte disabled:cursor-not-allowed transition-colors"
            >
              {calculando ? "Calculando…" : resultado ? "Recalcular costo" : "Calcular costo"}
            </button>

            {localidadesElegidas.length === 0 && (
              <p className="mt-2 text-xs text-tinta-suave">
                Elegi al menos una localidad para poder calcular.
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
            resultadoVigente ? "border-ahorro-borde" : "border-linea opacity-60",
          ].join(" ")}
        >
          {!resultadoVigente && (
            <p className="text-xs text-aviso bg-aviso-tenue border border-aviso/20 rounded-lg px-3 py-2 mb-4">
              Cambiaste la canasta despues de calcular. Volve a calcular para ver el costo real.
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
                  etiqueta: "Por dia",
                  valor: formatearPesos(resultado.costo_total / 30),
                  detalle: "promedio del mes",
                },
                {
                  etiqueta: "Categorias",
                  valor: `${resultado.categorias_calculadas} de ${resultado.categorias_pedidas}`,
                  detalle:
                    provinciales > 0
                      ? `${provinciales} con precio de la provincia`
                      : "cotizadas con datos",
                },
                ...(localidadesElegidas.length > 0
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
                        {item.categoria}
                        <span className="text-tinta-suave text-xs">
                          {" "}
                          {item.cantidad} {item.unidad} · {item.gama}
                        </span>
                        {/* Marcado y no escondido: el total incluye un precio que
                            no es de la zona elegida, y quien lo lee tiene que
                            poder saberlo. */}
                        {item.origen_precio === "provincia" && (
                          <span
                            className="text-aviso text-xs"
                            title="Tu zona no tiene datos suficientes de esta categoria: se usa el precio de tu provincia."
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

          {sinCotizar.length > 0 && (
            <div className="mt-5 pt-4 border-t border-linea">
              <p className="text-xs text-aviso mb-1.5">
                Sin datos suficientes en tu zona ni en tu provincia, no entraron al total:
              </p>
              <p className="text-xs text-tinta-media">
                {sinCotizar.map((i) => `${i.categoria} (${i.gama})`).join(" · ")}
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
      {items.length > 0 && <DondeComprarla items={items} />}

      {/*
        Barra de sesion: la canasta se guarda sola en el navegador y el link
        permite llevarsela a otro dispositivo. Sin cuentas ni mails.
      */}
      {items.length > 0 && (
        <div className="mt-6 flex flex-wrap items-center gap-3 text-xs text-tinta-suave">
          <span className="inline-flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-ahorro" />
            Se guarda sola en este navegador
          </span>
          <span className="text-linea-fuerte">·</span>
          <button onClick={copiarLink} className="text-ahorro hover:text-ahorro-hover font-medium">
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
