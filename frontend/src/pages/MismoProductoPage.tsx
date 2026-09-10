import { useEffect, useState } from "react";
import { useSearchParams } from "react-router";
import { buscarProductos, obtenerProducto, obtenerProductosDestacados } from "../api/client";
import Titular, { Resaltado } from "../components/Titular";
import FilaDeCifras from "../components/FilaDeCifras";
import TiraDePuntos from "../components/TiraDePuntos";
import { fechaEnPalabras, formatearNumero, formatearPesos } from "../utils/formato";
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
const SUCURSALES_MINIMAS = 3;

type Busqueda = { consulta: string; productos?: ProductoComparado[]; error?: string };
type Detalle = { id: string; producto?: ProductoDetalle; error?: string };
type Destacados = { productos?: ProductoComparado[]; error?: string };

/** SEPA escribe las descripciones en mayusculas. En un titular grande eso grita,
 *  asi que se pasan a minuscula y la marca recupera su mayuscula inicial. */
function nombreLegible(descripcion: string, marca: string | null): string {
  let texto = descripcion.toLowerCase();
  for (const palabra of (marca ?? "").toLowerCase().split(/\s+/).filter((p) => p.length > 1)) {
    texto = texto.replace(new RegExp(`\\b${palabra.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "g"), (m) =>
      m.charAt(0).toUpperCase() + m.slice(1)
    );
  }
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

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

function VistaProducto({ estado, onVolver }: { estado: Detalle | null; onVolver: () => void }) {
  if (estado === null) return <p className="text-sm text-tinta-suave mb-10">Cargando…</p>;

  const volver = (
    <button onClick={onVolver} className="text-sm text-tinta-media hover:text-tinta mb-6">
      ← Todos los productos
    </button>
  );

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

      <ul className="bg-papel border border-linea rounded-2xl divide-y divide-linea">
        {p.precios.map((x) => (
          <li key={x.cadena} className="flex items-baseline gap-4 px-4 py-2.5">
            <span className="text-sm text-tinta flex-1 min-w-0 truncate">{x.cadena}</span>
            {x.precio_maximo > x.precio_minimo && (
              <span className="numero text-xs text-tinta-suave hidden sm:inline" title="Rango entre sucursales">
                {formatearPesos(x.precio_minimo)} a {formatearPesos(x.precio_maximo)}
              </span>
            )}
            <span className={`text-xs shrink-0 ${x.sucursales < SUCURSALES_MINIMAS ? "text-aviso" : "text-tinta-suave"}`}>
              {formatearNumero(x.sucursales)} {x.sucursales === 1 ? "sucursal" : "sucursales"}
            </span>
            <span className="numero text-sm font-semibold text-tinta w-24 text-right shrink-0">
              {formatearPesos(x.precio_mediano)}
            </span>
          </li>
        ))}
      </ul>
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
                Solo productos que venden 4 o mas cadenas, con el precio mas bajo y el mas alto informados por{" "}
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
