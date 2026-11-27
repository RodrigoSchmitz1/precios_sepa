# Design

## Context

La tubería de minoristas, tal como está hoy:

- **Ingesta local** (el portal bloquea IPs de datacenter): `ingesta_local.ps1` corre `ingesta_backfill.py`.
  - Ve qué fechas faltan leyendo particiones (gratis).
  - Por cada fecha corre `descargar_sepa.py` (extrae `sepaN/` por comercio de `COMERCIOS_OBJETIVO`) y `cargar_datos.py`.
  - `cargar_datos.py` carga sucursales y comercio con foto anterior y conservación de ausentes, y los productos con un *load job* `WRITE_TRUNCATE` a `sepa.productos$AAAAMMDD`.
  - Ajusta la retención del crudo y de sus copias en dbt, y dispara dbt.
- **BigQuery**:
  - `sepa.productos`: 4,28 GiB, partición por `fecha_datos`, 3 días, todo STRING, sin clustering.
  - `stg_productos` e `int_precio_producto_cadena`: incrementales, 3 días, reemplazo de particiones con *copy jobs*. Las fechas las elige `fechas_a_calcular`, que lee `INFORMATION_SCHEMA.PARTITIONS`.
  - Marts del último día; historia agregada por cadena (`historico_precio_producto` es un registro de cambios).
  - La API lee los marts enteros con Storage Read y no hace consultas por pedido.
- **Formato**: `seeds/mapeo_cadenas.csv` → `stg_comercio.formato` (`supermercado` | `farmacia`).
  - Llega a `int_precio_producto_cadena`, `mart_mismo_producto` y `mart_mapa_sucursales`.
  - La API lo usa como `farmacia: true` y `es_farmacia`.
  - `compite_en_rubro` y los marts de categorías filtran por él.

La fuente mayorista está relevada en proposal.md. Los detalles que pesan en el diseño:

- `productos.csv` trae `precio_unitario_bulto_por_unidad_venta_con_iva/_sin_iva`, `unidad_venta`, `precio_bulto_con_iva/_sin_iva`, `id_dun_14` y promos con y sin IVA. No trae presentación.
- `sucursales.csv` y `comercio.csv` tienen las mismas columnas que en minoristas.
- El comercio 68 llega vacío y con el esquema minorista.

## Goals / Non-Goals

**Goals:**
- Mayoristas con el mismo grano que minoristas, sin acoplar las dos ingestas: una falla de un lado no tumba al otro.
- Que la app y los marts lean todo con la misma lógica, decidiendo por `formato` y no por la fuente.
- Ningún titular, índice ni comparación de súper cambia por sumar mayoristas.
- Costo dentro del uso gratuito, medido antes y después.

**Non-Goals:**
- Historia por sucursal, ni de mayoristas ni de minoristas.
- Categorizar los productos que solo están en mayoristas (usa Gemini). Quedan sin categoría: no entran en categorías ni en la canasta, y sus promos se ven sin rubro.
- El perfil Comercio y Changuito Empresas.
- Clustering de `sepa.productos`. No ahorraría nada: dbt recorre la partición entera y la API no hace consultas por pedido.

## Decisions

### 1. Un crudo hermano y no la misma tabla

`sepa.productos_mayoristas` tiene las 13 columnas de `sepa.productos` con el mismo nombre y tipo, más estas:
- `unidades_bulto`;
- `precio_bulto`;
- `precio_unitario_sin_iva`, `precio_bulto_sin_iva`;
- `promo1_sin_iva`, `promo2_sin_iva`;
- `id_dun_14`.

Partición por `fecha_datos`, misma retención y clustering por `id_comercio`, `id_producto`, `id_sucursal` (gratis y ayuda a quien filtre por producto).

- **Por qué aparte:** el reemplazo idempotente de un día es un `WRITE_TRUNCATE` de la partición. Con una sola tabla, cargar mayoristas pisaría a minoristas del mismo día o obligaría a esperar a los dos portales. Aparte, cada fuente reemplaza su día sola.
- **Alternativa descartada:** misma tabla con `WRITE_APPEND`. No es idempotente: una recarga duplica.

### 2. Mapeo de columnas

| crudo | de SEPA mayoristas |
|---|---|
| `productos_precio_lista` | `precio_unitario_bulto_por_unidad_venta_con_iva` |
| `productos_precio_unitario_promo1/2` | `productos_precio_unitario_con_iva_promo1/2`, vacío si es 0 |
| `productos_leyenda_promo1/2` | ídem, vacío si es solo espacios |
| `productos_cantidad_presentacion`, `productos_unidad_medida_presentacion` | `1`, `UNI` |
| `unidades_bulto`, `precio_bulto`, `*_sin_iva`, `id_dun_14` | las columnas originales |

Presentación `1 UNI` a propósito: es exactamente el caso en que `stg_productos` ya lee el tamaño de la descripción (la regla de Carrefour). Ahorra una regla nueva y cumple la spec de tamaño.

### 3. Una sola tubería con el dataset como parámetro

- `descargar_sepa.py --dataset mayoristas`:
  - otra URL de API;
  - carpetas `mayoristaN/`, aparte de las `sepaN/` de minoristas, para que la limpieza de una descarga no borre la otra;
  - acepta todo comercio cuyo `productos.csv` traiga `unidad_venta`, así entran solos los que empiecen a informar;
  - el que llegue con otro esquema (el 68) se saltea con aviso.
- `limpiar_carpetas_comercios` borra solo las carpetas del dataset que va a bajar.
- `cargar_datos.py` carga en una sola pasada:
  - sucursales y comercio de los dos datasets, con una foto anterior por día;
  - `sepa.productos` con las carpetas minoristas;
  - `sepa.productos_mayoristas` con las mayoristas.

  La conservación de ausentes deja de usar la lista fija `COMERCIOS`. Pasa a ser "los `id_comercio` numéricos del destino que no vinieron hoy", así no se pierden los del otro dataset. El filtro numérico excluye la fila de pie "Última actualización", que era la razón de la lista fija.
- `ingesta_backfill.py`, por cada fecha que falta en minoristas: baja minoristas, baja mayoristas (si falla, se anota y sigue) y carga todo junto.
- Además, carga solo productos de mayoristas para cada fecha que esté en el crudo minorista y falte en el crudo mayorista. No toca sucursales, para no pisar la foto anterior.
- Sale con error si falló cualquiera de las dos.

**Alternativa descartada:** un script de mayoristas aparte con su propia carga de sucursales. Cargaría la dimensión dos veces por día y pisaría la foto anterior: la detección de cambios de minoristas dejaría de ver los cambios del día.

### 4. Retención y fechas tardías

- `ajustar_retencion` suma `sepa.productos_mayoristas` a la lista de tablas que ajusta: misma ventana que el crudo minorista.
- `fechas_a_calcular` acepta una segunda fuente. Para `stg_productos` e `int_precio_producto_cadena` recalcula también la fecha cuya partición de mayoristas es más nueva (`last_modified_time`) que la del destino. Es metadata de `INFORMATION_SCHEMA.PARTITIONS`, la misma que ya lee.
- Así un mayorista cargado tarde entra en los precios de esa fecha, y en el arrastre de Mismo producto si falta el último día.
- La historia de precio es un registro de cambios que solo ve el último día: un cambio tardío aparece con la fecha de la corrida, como ya pasa con minoristas.

### 5. Formato por origen, con nombre del seed

- `stg_comercio.formato = COALESCE(seed.formato, IF(id_comercio IN comercios_mayoristas(), 'mayorista', 'supermercado'))`.
- `comercios_mayoristas()` (macro) son los del seed con formato mayorista más los que declaran sucursales de tipo "mayorista". Se eligió el tipo de sucursal y no "está en el crudo mayorista" porque el crudo vence a los 3 días y la dimensión no: unos días sin ingesta habrían convertido a los mayoristas en súper. Medido el 26-11: ninguna de las ~2.900 sucursales minoristas declara ese tipo y las 91 mayoristas sí.
- Un mayorista nuevo que SEPA empiece a publicar queda marcado como mayorista aunque nadie lo haya cargado en el seed. Sin esto entraría como súper por el `COALESCE` actual y competiría en todo.
- El seed suma las 6 filas actuales con nombre comercial: Makro, Maxiconsumo, Yaguar, Basualdo, Nini, "La Agricola Regional (mayorista)".
- Los números de comercio repetidos entre datasets se chequean en la ingesta (`cargar_datos.comercios_repetidos`), que es gratis porque la lista de minoristas es fija. En dbt habría que recorrer los dos crudos todos los días.

### 6. Exclusiones en un solo lugar

- **`compite_en_rubro`** pasa a `formato = 'supermercado' OR (formato = 'farmacia' AND rubro IN rubros_farmacia)`. Hoy deja competir en Higiene y Bebés a cualquier formato que no sea súper. Con esto quedan afuera de Más barato, `mart_precios_cadena_categoria` y, por esa vía, del índice de inflación.
- **Ya excluidos** por `formato = 'supermercado'`: `mart_precio_categoria_sucursal` y `_localidad` (Tu canasta).
- **`mart_gama_productos`**: suma el filtro (hoy lee `stg_productos` sin mirar formato).
- **`mart_cambio_precio`**: filtra mayoristas (alimenta "lo que más subió" de la portada).
- **`mart_mismo_producto`**:
  - conserva las filas de mayoristas con `formato`, `unidades_bulto` y `precio_bulto`;
  - la referencia del mercado, la credibilidad, la más barata, la más cara y la brecha se calculan con lo que no es mayorista;
  - el precio de un mayorista se marca no creíble con los mismos umbrales contra esa referencia. Los precios absurdos de Basualdo quedan marcados y no se destacan.
- **Interruptor `mayoristas_activos`** (var de dbt, falso por defecto): las uniones del crudo leen mayoristas solo cuando es verdadero, y `stg_sucursales` y `stg_comercio` dejan afuera los comercios mayoristas mientras esta apagado. Sin esto, la carga combinada de sucursales pondria a Makro en el mapa como supermercado apenas entrara la ingesta nueva. Hay un test que con el interruptor apagado no deja ninguna fila de formato `mayorista` en los marts.

### 7. Coordenadas

`seeds/coordenadas_sucursales.csv`: `id_comercio, id_bandera, id_sucursal, latitud, longitud, fuente`.

- `stg_sucursales` usa la coordenada de SEPA cuando trae las dos, y si no, la del seed.
- Las 24 de Makro se buscan una vez con Nominatim de OpenStreetMap:
  - gratis, una consulta por segundo, User-Agent genérico;
  - a partir de calle, número, localidad y provincia;
  - se revisan a mano contra la localidad y la latitud que SEPA sí trae, y la diferencia tiene que ser menor a 0,05°.
- Un test falla si una sucursal con precios queda sin coordenadas.

### 8. API y app siguen el camino de farmacia

- **`mapa_promos`**: `es_farmacia` pasa a un formato por sucursal. Las zonas cuentan solo súper y listan aparte `farmacias` y `mayoristas`.
- **`mismo_producto`**:
  - los precios mayoristas van a una lista aparte del producto (`mayoristas`, con `unidades_bulto` y `precio_bulto`), no a `precios`. Así la más barata, la zona, Tu lista, Dónde comprarla, Más barato y la portada, que leen `precios`, siguen siendo entre súper sin tocar cada lugar;
  - `cotizar_lista` recibe los mayoristas cerca y suma `mayoristas`: por cada uno, productos que tiene y suma por unidad.
- **Vidriera**: fila de mayorista después de las de súper; sus promos no entran en las promos fuertes ni en las filas por rubro, y no se nombra entre las que casi no informan.
- **Titular del producto**: el aviso de "con promo" no usa promos de mayoristas.
- **Frontend**:
  - bloque "En mayoristas, comprando el bulto" en el detalle de un producto, con diferencia contra el súper más barato;
  - sección en Tu lista;
  - etiqueta "Mayorista" con el bulto en promos;
  - marcador distinto en el mapa;
  - "mayoristas cerca" en el selector de zona.

### 9. Orden de despliegue

1. dbt con el interruptor apagado. Tiene que entrar antes o junto con la ingesta: el filtro de staging es lo que impide que las sucursales mayoristas de la carga combinada lleguen al mapa como súper.
2. Ingesta.
3. API y frontend.
4. Interruptor encendido.

Cada paso con el OK de Rodrigo. Mientras el interruptor está apagado, los marts y la app quedan como hoy.

## Risks / Trade-offs

- [Un mayorista con precio por unidad más bajo arruina las comparaciones de súper] → exclusión por formato en un solo lugar por tipo de cálculo, con tests de que Más barato, la inflación y los titulares dan lo mismo con el interruptor prendido o apagado.
- [Una tienda nueva en SEPA mayoristas entra como súper] → formato por origen (decisión 5).
- [La carga de dimensiones borra al otro dataset] → conservación por "no vino hoy" en vez de lista fija, con una prueba que carga solo minoristas y verifica que las sucursales mayoristas siguen.
- [Geocodificación equivocada] → revisión a mano contra la latitud de SEPA y la localidad; el seed guarda la fuente.
- [El tamaño desde la descripción no reconoce algunos productos mayoristas] → solo afecta comparaciones por kilo o litro, de las que los mayoristas quedan afuera. Se mide qué proporción se reconoce y queda anotado.
- [Basualdo publica precios de una sola sucursal y ~10% absurdos] → credibilidad contra la referencia de súper; se anota en el informe.
- [Costo] → +~0,3 GiB de almacenamiento y ~+0,3 GiB de consultas por día. Se mide con `JOBS_BY_PROJECT` y `num_bytes` el día antes y la semana después de encender el interruptor.

## Verificación hecha (26-11)

- Con el interruptor apagado, los marts reconstruidos en un dataset de validación dan lo mismo que producción, salvo ruido que ya tenía producción: `APPROX_QUANTILES` en `int_precio_producto_cadena` (123 medianas distintas entre dos corridas con los mismos datos, hasta 22%) y empates sin desempate en marca (≈150 productos) y en el voto del tamaño (≈10).
- Con el interruptor prendido: ningún mayorista en Más barato; en Mismo producto entran 25.744 filas de mayoristas, ninguna "la más barata", y los súper no cambian fuera de ese ruido; 91 sucursales en el mapa, todas con coordenadas; promos de súper idénticas a producción y 3.233 de mayoristas (Nini y Yaguar) con su bulto. Falta comprobar el índice de inflación con las dimensiones reales.
- La validación costó ~17 GiB de cuota (los modelos incrementales informan "0 processed" pero leen el crudo de un día cada vez).

## Migration Plan

1. Crear `sepa.productos_mayoristas` desde `cargar_datos.py` si no existe, con el esquema de la decisión 1.
2. Correr la ingesta a mano sobre la semana publicada y verificar conteos contra el relevamiento (≈390 mil filas por día, 91 sucursales).
3. Desplegar dbt con `mayoristas_activos: false` y verificar que los marts no cambian (mismas filas que el día anterior en Más barato, inflación y portada).
4. Con el OK de Rodrigo, desplegar API y frontend, y encender el interruptor.
5. **Vuelta atrás:** apagar `mayoristas_activos`. Los marts vuelven a ser solo minoristas en la corrida siguiente; la ingesta puede seguir cargando sin efecto visible.
