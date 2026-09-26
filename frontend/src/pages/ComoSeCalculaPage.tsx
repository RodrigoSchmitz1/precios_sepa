import type { ReactNode } from "react";
import { Link } from "react-router";
import Titular from "../components/Titular";
import { EVIDENCIA, NIVELES_EVIDENCIA } from "../utils/evidencia";

/*
  Como se calcula cada numero del sitio, en una sola pagina (2026-09-26).

  Cada seccion ya explica lo suyo en la bajada, pero corto: lo justo para leer
  el dato. Aca va lo que alguien que desconfia del numero quiere saber antes de
  creerlo: de donde sale, que se descarta y que no cubre. Esta escrita para
  quien no sabe que es SEPA ni que es una mediana, sin la historia de como se
  llego a cada regla: esa vive en el README.

  Las cifras de las reglas (6 observaciones, 3 sucursales, la mitad o el doble)
  son las de los modelos de dbt. Si cambia una, cambia aca.
*/

type Seccion = {
  ruta: string;
  nombre: string;
  parrafos: ReactNode[];
};

const SECCIONES: Seccion[] = [
  {
    ruta: "/",
    nombre: "Promos",
    parrafos: [
      "Una promo es un producto cuyo precio promocional esta por debajo de su precio de lista en esa sucursal. El descuento es la diferencia entre los dos.",
      <>
        Cada promo dice con que se sostiene su descuento:
        <ul className="mt-2 space-y-1.5 list-disc pl-5">
          {NIVELES_EVIDENCIA.map((nivel) => (
            <li key={nivel}>
              <strong className={`font-medium ${EVIDENCIA[nivel].color}`}>{EVIDENCIA[nivel].texto}</strong>:{" "}
              {EVIDENCIA[nivel].ayuda}
            </li>
          ))}
        </ul>
      </>,
      "Se descartan los valores que no son descuentos: algunas cadenas cargan en esa columna el valor de una cuota, y un colchon aparecia con 98% de descuento.",
    ],
  },
  {
    ruta: "/canasta",
    nombre: "Canasta basica",
    parrafos: [
      "Las cantidades son las de la canasta basica alimentaria del INDEC para un adulto durante un mes (region GBA). Para un hogar se multiplica por sus adultos equivalentes: una familia de dos adultos y dos chicos cuenta como 3,09.",
      "Cada categoria se valua con el precio por kilo, litro o unidad de los productos mas baratos de la categoria (el tercio economico), tomando la mediana de las sucursales de la localidad. Hacen falta al menos 6 precios; si no llega, se usa la mediana de la provincia, en hasta 4 categorias.",
      "Solo aparecen las localidades donde se puede medir la canasta entera. Sumar lo que cada una tenga haria parecer mas baratas a las que tienen menos datos.",
    ],
  },
  {
    ruta: "/canasta-personalizada",
    nombre: "Tu canasta",
    parrafos: [
      "Lo que escribis lo interpreta una IA, que elige categorias y cantidades partiendo de las de la canasta del INDEC. Es un punto de partida: cada cantidad se puede cambiar.",
      "Cada categoria se cotiza con la mediana del precio por kilo, litro o unidad de la gama elegida en las localidades que marques. Si tu zona no tiene datos de una categoria, se usa el precio de la provincia y se aclara.",
      "En las categorias que se compran por pieza (huevos, panales, toallitas) la cantidad sale del envase: un maple de 30 huevos cuenta como 30. Lo que no dice cuantas piezas trae no entra en ese precio.",
    ],
  },
  {
    ruta: "/quien-gana",
    nombre: "Mas barato",
    parrafos: [
      "Se comparan productos identicos, con el mismo codigo de barras, entre cadenas. Para cada producto gana la cadena con el precio mas bajo.",
      "El porcentaje de una cadena es sobre los productos que ella vende, no sobre todos: una cadena con poco surtido no pierde por los productos que no tiene. Una celda vacia quiere decir que no hay 20 productos comparables, no que la cadena pierda siempre.",
    ],
  },
  {
    ruta: "/mismo-producto",
    nombre: "Mismo producto",
    parrafos: [
      "El precio de cada cadena es la mediana entre sus sucursales. Una diferencia se destaca solo si cada extremo sale de al menos 3 sucursales: con tres, una sucursal con el precio mal cargado no mueve la mediana.",
      "Un precio a menos de la mitad o a mas del doble de lo que cobran las demas empresas no entra en la diferencia, salvo que otra empresa cobre casi lo mismo. Se muestra tachado, para que se vea que existe y por que no cuenta.",
    ],
  },
  {
    ruta: "/inflacion",
    nombre: "Inflacion",
    parrafos: [
      "Cada dia se compara contra el anterior usando solo los productos que estan en las dos fechas, y los dias se encadenan. Asi, que una cadena agregue o saque productos no se confunde con una suba o una baja.",
      "La variacion de una categoria es la media geometrica de las de sus productos, que es como lo calculan los indices oficiales. Solo aparecen las categorias que venden al menos 3 cadenas.",
    ],
  },
];

function ComoSeCalculaPage() {
  return (
    <div className="max-w-4xl mx-auto">
      <Titular
        antetitulo="Como se calcula"
        bajada={
          <p>
            Todos los precios salen de SEPA, el sistema en el que los supermercados le informan a la Secretaria de
            Comercio el precio de cada producto en cada sucursal, todos los dias: unos 14 millones de precios por dia.
            El sitio se actualiza una vez por dia.
          </p>
        }
      >
        De donde sale cada numero
      </Titular>

      <div className="space-y-10">
        {SECCIONES.map((seccion) => (
          <section key={seccion.ruta}>
            <h2 className="font-display text-2xl text-tinta mb-3">
              <Link to={seccion.ruta} className="hover:text-ahorro transition-colors">
                {seccion.nombre}
              </Link>
            </h2>
            <div className="space-y-3 text-sm leading-relaxed text-tinta-media max-w-2xl">
              {seccion.parrafos.map((parrafo, i) => (
                <div key={i}>{parrafo}</div>
              ))}
            </div>
          </section>
        ))}

        <section className="border-t border-linea pt-8">
          <h2 className="font-display text-2xl text-tinta mb-3">Lo que no cubre</h2>
          <div className="space-y-3 text-sm leading-relaxed text-tinta-media max-w-2xl">
            <p>
              Solo las cadenas que informan a SEPA. No hay carnicerias, verdulerias ni almacenes de barrio, asi que
              la carne y la verdura que se cotizan son las del super.
            </p>
            <p>
              Son los precios que informa cada cadena, no los de la gondola: pueden diferir. Cuando un precio se
              aparta mucho del resto del mercado, el sitio lo marca en vez de publicarlo como dato.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}

export default ComoSeCalculaPage;
