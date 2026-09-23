import { useEffect, useState } from "react";
import { useSearchParams } from "react-router";
import { buscarProductos, obtenerProducto, obtenerProductosDestacados } from "../api/client";
import Titular, { Resaltado } from "../components/Titular";
import FilaDeCifras from "../components/FilaDeCifras";
import TiraDePuntos from "../components/TiraDePuntos";
import { fechaEnPalabras, formatearNumero, formatearPesos } from "../utils/formato";
import { nombreLegible } from "../utils/texto";
import type { PrecioEnCadena, ProductoComparado, ProductoDetalle } from "../types";

/*
  El mismo producto: cuanto cuesta el mismo codigo de barras en cada cadena.

  Es la comparacion mas directa que permiten los datos: mismo producto, misma
  presentacion, y la unica diferencia es donde se compra. No hace falta
  normalizar por kilo ni elegir una canasta, asi que el numero se entiende sin
  leer la metodologia.

  El producto elegido va en la URL (?p=codigo) para que se pueda compartir.
*/

// Igual que SUCURSALES_MINIMAS_EXTREMO en api/mismo_producto.py: debajo de esto
// la mediana de la cadena puede ser un precio mal cargado en una sola sucursal.
/*
  Los dos productos que se muestran desplegados al entrar. Van por BUSQUEDA y no
  por codigo de barras: el id de un producto puede dejar de estar en el mart
  cualquier dia (si esa fecha no lo informa una segunda cadena, sale), y un
  ejemplo fijo que desaparece deja la portada vacia. Buscando, si cambia el
  envase o el codigo, sigue apareciendo el producto equivalente.

  Se eligen conocidos y no los de mayor diferencia: la portada tiene que
  mostrar como se ve la comparacion, y para eso sirve mas algo que el visitante
  compra que el producto mas disparatado del dia.
*/
const EJEMPLOS = ["coca cola 2.25", "yerba playadito"];

const SUCURSALES_MINIMAS = 3;
// Igual que EMPRESAS_MINIMAS_DESTACADO en api/mismo_producto.py.
const EMPRESAS_MINIMAS = 3;

type Busqueda = { consulta: string; productos?: ProductoComparado[]; error?: string };
type Detalle = { id: string; producto?: ProductoDetalle; error?: string };
type Destacados = { productos?: ProductoComparado[]; error?: string };

function porcentaje(valor: number): string {
  return `${Math.round(valor).toLocaleString("es-AR")}%`;
}

/** "Coto" o "Coto y 2 mas" cuando varias cadenas empatan en el extremo. */
function nombrarCadenas(lista: PrecioEnCadena[]): string {
  return lista.length === 1 ? lista[0].cadena : `${lista[0].cadena} y ${lista.length - 1} mas`;
}

function Aviso({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-sm text-alerta bg-alerta-tenue border border-alerta/20 rounded-lg px-3 py-2">{children}</p>
  );
}

/*
  Un ejemplo de la portada: el nombre del producto, la visual con los precios de
  cada cadena y el despliegue por super. Sin Titular a proposito: VistaProducto
  lo incluye, y dos de esas en la portada repetian la banda oscura tres veces en
  la misma pantalla.
*/
function EjemploComparacion({ p, onVer }: { p: ProductoDetalle; onVer: (id: string) => void }) {
  const nombre = nombreLegible(p.descripcion, p.marca);
  const baratos = p.precios.filter((x) => x.precio_mediano === p.precio_mas_bajo);
  const caros = p.precios.filter((x) => x.precio_mediano === p.precio_mas_alto);
  const hayDiferencia = p.precio_mas_alto > p.precio_mas_bajo;

  return (
    <article className="mb-8">
      <button onClick={() => onVer(p.id_producto)} className="group text-left mb-1">
        <h3 className="font-display text-2xl text-tinta group-hover:text-ahorro transition-colors">{nombre}</h3>
      </button>
      <p className="text-sm text-tinta-media mb-4">
        {hayDiferencia ? (
          <>
            <span className="text-alerta font-medium">{porcentaje(p.diferencia_pct)} mas caro</span> en{" "}
            {nombrarCadenas(caros)} que en {nombrarCadenas(baratos)} · {p.cadenas} cadenas
          </>
        ) : (
          <>El mismo precio en las {p.cadenas} cadenas</>
        )}
      </p>

      {hayDiferencia && (
        <div className="mb-4">
          <TiraDePuntos
            puntos={p.precios.map((x) => ({ id: x.cadena, valor: x.precio_mediano, nombre: x.cadena }))}
            formatear={formatearPesos}
            descripcion={`Precio de ${nombre} en cada cadena, de ${formatearPesos(p.precio_mas_bajo)} a ${formatearPesos(p.precio_mas_alto)}`}
          />
        </div>
      )}

      <ListaDePrecios p={p} />
    </article>
  );
}

/** La lista de precios por cadena. Se extrae de VistaProducto para poder
 *  mostrarla tambien en los ejemplos de la portada, donde no va el titular. */
function ListaDePrecios({ p }: { p: ProductoDetalle }) {
  return (
      <ul className="bg-papel border border-linea rounded-2xl divide-y divide-linea">
      {p.precios.map((x) => (
        <li
          key={x.cadena}
          className={`flex items-baseline gap-4 px-4 py-2.5 ${x.precio_creible ? "" : "bg-papel-hundido"}`}
        >
          <span className="text-sm text-tinta flex-1 min-w-0 truncate">
            {x.cadena}
            {/* Se dice por que esta atenuado. Un renglon en gris sin explicacion
                parece un error del sitio; con el motivo, es informacion. */}
            {!x.precio_creible && (
              <span className="ml-2 text-xs text-aviso" title="Se aparta tanto de lo que informan las demas empresas que no se puede tomar como precio. No entra en el calculo de la diferencia.">
                sin verificar
              </span>
            )}
          </span>
          {x.precio_maximo > x.precio_minimo && (
            <span className="numero text-xs text-tinta-suave hidden sm:inline" title="Rango entre sucursales">
              {formatearPesos(x.precio_minimo)} a {formatearPesos(x.precio_maximo)}
            </span>
          )}
          <span className={`text-xs shrink-0 ${x.sucursales < SUCURSALES_MINIMAS ? "text-aviso" : "text-tinta-suave"}`}>
            {formatearNumero(x.sucursales)} {x.sucursales === 1 ? "sucursal" : "sucursales"}
          </span>
          <span
            className={`numero text-sm w-24 text-right shrink-0 ${
              x.precio_creible ? "font-semibold text-tinta" : "text-tinta-suave line-through"
            }`}
          >
            {formatearPesos(x.precio_mediano)}
          </span>
        </li>
      ))}
    </ul>
  );
}

function VistaProducto({ estado, onVolver }: { estado: Detalle | null; onVolver?: () => void }) {
  if (estado === null) return <p className="text-sm text-tinta-suave mb-10">Cargando…</p>;

  // Sin onVolver la vista se usa como ejemplo dentro de la portada de la
  // seccion, donde no hay de donde volver.
  const volver = onVolver ? (
    <button onClick={onVolver} className="text-sm text-tinta-media hover:text-tinta mb-6">
      ← Todos los productos
    </button>
  ) : null;

  if (estado.error || !estado.producto) {
    return (
      <div className="mb-10">
        {volver}
        <Aviso>{estado.error ?? "No se encontro el producto."}</Aviso>
      </div>
    );
  }

  const p = estado.producto;
  const nombre = nombreLegible(p.descripcion, p.marca);
  const baratos = p.precios.filter((x) => x.precio_mediano === p.precio_mas_bajo);
  const caros = p.precios.filter((x) => x.precio_mediano === p.precio_mas_alto);
  const hayDiferencia = p.precio_mas_alto > p.precio_mas_bajo;

  return (
    <section className="mb-12">
      {volver}
      <Titular
        antetitulo="El mismo producto"
        bajada={
          <>
            <p>
              Mismo codigo de barras ({p.id_producto}) en {p.cadenas} cadenas, con precios del{" "}
              {fechaEnPalabras(p.fecha_datos)}. El precio de cada cadena es la mediana entre sus sucursales.
            </p>
            {hayDiferencia && !p.extremos_respaldados && (
              <p className="mt-2 text-sm text-aviso">
                El precio mas bajo o el mas alto sale de menos de {SUCURSALES_MINIMAS} sucursales: la diferencia
                puede deberse a un precio mal cargado.
              </p>
            )}
          </>
        }
      >
        {!hayDiferencia ? (
          <>
            {nombre}: el mismo precio en las {p.cadenas} cadenas
          </>
        ) : p.extremos_respaldados ? (
          <>
            {nombre}: <Resaltado>{porcentaje(p.diferencia_pct)} mas caro</Resaltado> en {nombrarCadenas(caros)} que
            en {nombrarCadenas(baratos)}
          </>
        ) : (
          <>
            {nombre}: de {formatearPesos(p.precio_mas_bajo)} a {formatearPesos(p.precio_mas_alto)} segun la cadena
          </>
        )}
      </Titular>

      {hayDiferencia && (
        <div className="mb-6">
          <TiraDePuntos
            puntos={p.precios.map((x) => ({ id: x.cadena, valor: x.precio_mediano, nombre: x.cadena }))}
            formatear={formatearPesos}
            descripcion={`Precio de ${nombre} en cada cadena, de ${formatearPesos(p.precio_mas_bajo)} a ${formatearPesos(p.precio_mas_alto)}`}
          />
        </div>
      )}

      <div className="mb-6">
        <FilaDeCifras
          cifras={[
            { etiqueta: "Mas barato", valor: formatearPesos(p.precio_mas_bajo), detalle: nombrarCadenas(baratos) },
            { etiqueta: "Mas caro", valor: formatearPesos(p.precio_mas_alto), detalle: nombrarCadenas(caros) },
            {
              etiqueta: "Diferencia",
              valor: formatearPesos(p.precio_mas_alto - p.precio_mas_bajo),
              detalle: "por el mismo producto",
            },
            { etiqueta: "Cadenas", valor: formatearNumero(p.cadenas), detalle: "con este codigo de barras" },
          ]}
        />
      </div>

      <ListaDePrecios p={p} />
    </section>
  );
}

function FilaProducto({ producto, onElegir }: { producto: ProductoComparado; onElegir: (id: string) => void }) {
  const hayDiferencia = producto.precio_mas_alto > producto.precio_mas_bajo;
  return (
    <li>
      <button
        onClick={() => onElegir(producto.id_producto)}
        className="w-full flex items-baseline gap-4 px-4 py-3 text-left hover:bg-papel-hundido transition-colors"
      >
        <span className="flex-1 min-w-0">
          <span className="block text-sm text-tinta truncate">
            {nombreLegible(producto.descripcion, producto.marca)}
          </span>
          <span className="block text-xs text-tinta-suave numero">
            {producto.cadenas} cadenas · {formatearPesos(producto.precio_mas_bajo)}
            {hayDiferencia && ` a ${formatearPesos(producto.precio_mas_alto)}`}
          </span>
        </span>
        <span
          className={`numero text-sm font-semibold shrink-0 ${
            hayDiferencia && producto.extremos_respaldados ? "text-alerta" : "text-tinta-suave"
          }`}
        >
          {hayDiferencia ? `+${porcentaje(producto.diferencia_pct)}` : "igual"}
        </span>
      </button>
    </li>
  );
}

function MismoProductoPage() {
  const [params, setParams] = useSearchParams();
  const id = params.get("p");

  const [texto, setTexto] = useState("");
  const consulta = texto.trim();
  const [busqueda, setBusqueda] = useState<Busqueda | null>(null);
  const [detalle, setDetalle] = useState<Detalle | null>(null);
  const [destacados, setDestacados] = useState<Destacados | null>(null);
  const [ejemplos, setEjemplos] = useState<ProductoDetalle[]>([]);

  useEffect(() => {
    let cancelado = false;
    obtenerProductosDestacados()
      .then((productos) => {
        if (!cancelado) setDestacados({ productos });
      })
      .catch((err) => {
        if (!cancelado) setDestacados({ error: err.message });
      });
    return () => {
      cancelado = true;
    };
  }, []);

  useEffect(() => {
    if (consulta.length < 2) return;
    let cancelado = false;
    const espera = setTimeout(() => {
      buscarProductos(consulta)
        .then((productos) => {
          if (!cancelado) setBusqueda({ consulta, productos });
        })
        .catch((err) => {
          if (!cancelado) setBusqueda({ consulta, error: err.message });
        });
    }, 300);
    return () => {
      cancelado = true;
      clearTimeout(espera);
    };
  }, [consulta]);

  /*
    La portada de la seccion abria con una lista de nombres y un porcentaje. Lo
    que hace interesante a esta pagina -la comparacion del mismo codigo de
    barras entre cadenas- quedaba a un click de distancia y no se descubria: el
    visitante veia productos que no le importaban y se iba antes de buscar el
    suyo.

    Ahora se despliegan dos ejemplos ya armados. No cuesta cuota: los detalles
    salen del mismo indice en memoria que ya se cargo para los destacados.
  */
  useEffect(() => {
    if (id) return;
    let cancelado = false;
    Promise.all(
      EJEMPLOS.map((consulta) =>
        buscarProductos(consulta).then((r) => (r.length > 0 ? obtenerProducto(r[0].id_producto) : null))
      )
    )
      .then((todos) => todos.filter((x): x is ProductoDetalle => x !== null))
      .then((detalles) => {
        if (!cancelado) setEjemplos(detalles);
      })
      .catch(() => {
        // Sin ejemplos la pagina sigue sirviendo: el buscador es lo principal.
      });
    return () => {
      cancelado = true;
    };
  }, [id]);

  useEffect(() => {
    if (!id) return;
    let cancelado = false;
    obtenerProducto(id)
      .then((producto) => {
        if (!cancelado) setDetalle({ id, producto });
      })
      .catch((err) => {
        if (!cancelado) setDetalle({ id, error: err.message });
      });
    return () => {
      cancelado = true;
    };
  }, [id]);

  // Estados de carga derivados, como en el resto de las paginas: lo cargado
  // solo cuenta si corresponde a lo que se esta pidiendo ahora.
  const busquedaVigente = consulta.length >= 2 && busqueda?.consulta === consulta ? busqueda : null;
  const detalleVigente = id && detalle?.id === id ? detalle : null;

  const elegir = (idProducto: string) => {
    setParams({ p: idProducto });
    setTexto("");
    window.scrollTo({ top: 0 });
  };

  const mayor = destacados?.productos?.[0];

  return (
    <div className="max-w-4xl mx-auto">
      {id ? (
        <VistaProducto estado={detalleVigente} onVolver={() => setParams({})} />
      ) : (
        <Titular
          antetitulo="El mismo producto"
          bajada="Mismo codigo de barras, misma presentacion: la unica diferencia es donde lo compras. Busca un producto y mira cuanto cuesta en cada cadena."
        >
          {mayor ? (
            <>
              El mismo producto puede costar <Resaltado>{porcentaje(mayor.diferencia_pct)} mas</Resaltado> segun la
              cadena
            </>
          ) : (
            "El mismo producto, otro precio"
          )}
        </Titular>
      )}

      <section className="mb-10" aria-label="Buscar un producto">
        <input
          type="search"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder={id ? "Buscar otro producto" : "Buscar: yerba playadito, aceite natura, coca cola 2,25"}
          aria-label="Buscar un producto"
          autoComplete="off"
          className="w-full bg-papel border border-linea rounded-xl px-4 py-3 text-base focus:outline-none focus:border-ahorro"
        />

        {consulta.length >= 2 && busquedaVigente === null && (
          <p className="mt-3 text-sm text-tinta-suave">Buscando…</p>
        )}
        {busquedaVigente?.error && (
          <div className="mt-3">
            <Aviso>{busquedaVigente.error}</Aviso>
          </div>
        )}
        {busquedaVigente?.productos && busquedaVigente.productos.length === 0 && (
          <p className="mt-3 text-sm text-tinta-suave">
            Ningun producto con esas palabras tiene precio en dos o mas cadenas.
          </p>
        )}
        {busquedaVigente?.productos && busquedaVigente.productos.length > 0 && (
          <ul className="mt-3 bg-papel border border-linea rounded-2xl divide-y divide-linea overflow-hidden">
            {busquedaVigente.productos.map((producto) => (
              <FilaProducto key={producto.id_producto} producto={producto} onElegir={elegir} />
            ))}
          </ul>
        )}
      </section>

      {!id && consulta.length < 2 && ejemplos.length > 0 && (
        <section aria-labelledby="titulo-ejemplos" className="mb-12">
          <h2 id="titulo-ejemplos" className="text-xs font-semibold uppercase tracking-wider text-tinta-suave mb-4">
            Asi se ve la comparacion
          </h2>
          {ejemplos.map((producto) => (
            <EjemploComparacion key={producto.id_producto} p={producto} onVer={elegir} />
          ))}
        </section>
      )}

      {!id && consulta.length < 2 && (
        <section aria-labelledby="titulo-destacados">
          <h2 id="titulo-destacados" className="text-xs font-semibold uppercase tracking-wider text-tinta-suave mb-3">
            Las mayores diferencias de hoy
          </h2>
          {destacados === null && <p className="text-sm text-tinta-suave">Cargando…</p>}
          {destacados?.error && <Aviso>{destacados.error}</Aviso>}
          {destacados?.productos && (
            <>
              <ul className="bg-papel border border-linea rounded-2xl divide-y divide-linea overflow-hidden">
                {destacados.productos.map((producto) => (
                  <FilaProducto key={producto.id_producto} producto={producto} onElegir={elegir} />
                ))}
              </ul>
              <p className="mt-3 text-xs text-tinta-suave leading-relaxed">
                Solo productos que venden {EMPRESAS_MINIMAS} o mas empresas distintas -no banderas de la misma,
                como las cuatro de Carrefour-, con el precio mas bajo y el mas alto informados por{" "}
                {SUCURSALES_MINIMAS} o mas sucursales cada uno: asi una sucursal con un precio mal cargado no puede
                aparecer como la mayor diferencia del dia.
              </p>
            </>
          )}
        </section>
      )}
    </div>
  );
}

export default MismoProductoPage;
