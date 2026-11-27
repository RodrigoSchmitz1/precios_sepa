# Proposal

## Why

Changuito usa solo SEPA minoristas. SEPA publica aparte el dataset de **mayoristas**, con el mismo detalle: precio por producto, sucursal y día, con promos. Hace falta para tres cosas: que quien vive cerca de un mayorista vea sus precios y promos en el mapa y en la comparación; el perfil Comercio que viene después (el almacenero decide dónde reponer y compara su costo contra el súper de su zona); y el canal tradicional en Changuito Empresas. Agregar por cadena perdería la sucursal y la promo, así que entra igual que minoristas.

Relevado del 20 al 26-11-2026 sobre los archivos reales:

- Informan con precios 6 mayoristas y 91 sucursales: Makro (24), Maxiconsumo (38), Yaguar (19), Basualdo (4, con precios de 1), Nini (2) y La Agrícola Regional (4). **Vital y Diarco no informan a SEPA**, en ningún dataset. Maxi sigue en minoristas (SEPA declara sus sucursales como hiper o súper).
- ~390 mil filas por día (~59 MiB en BigQuery), 1/37 de minoristas.
- El precio viene por bulto, con las unidades por bulto y el precio por unidad comprando el bulto, con y sin IVA. Precio del bulto = precio por unidad × unidades en todas las filas menos 21 (de Nini). No trae gramos ni cc.
- Makro publica sus 24 sucursales sin longitud.
- Comprando el bulto, el mismo producto sale por unidad: Nini −25%, Yaguar −22%, Maxiconsumo −15% y Makro −8% contra la mediana de los súper.

## What Changes

- **Ingesta de mayoristas en la misma tubería**: la descarga diaria baja también el dataset `precios-claros-sepa-mayoristas`, con la misma recuperación de fechas que faltan. Los productos van a un crudo hermano, `sepa.productos_mayoristas`, con el mismo esquema que `sepa.productos`, la misma partición por fecha y la misma retención de 3 días. Las sucursales y los comercios van a las tablas de siempre, en la misma carga.
- **Precio por unidad**: el precio de lista de un mayorista es el precio por unidad comprando el bulto, con IVA. Se guardan también las unidades por bulto, el precio del bulto y los precios sin IVA. El tamaño en gramos o cc se lee de la descripción, con la regla que ya se usa para Carrefour.
- **Mayorista como formato**: `formato = 'mayorista'` en `mapeo_cadenas.csv`, como farmacia. Lo leen dbt, la API y la app.
- **Coordenadas que faltan**: una tabla de correcciones con la ubicación de las 24 sucursales de Makro, sacada una vez de OpenStreetMap a partir de la dirección y revisada a mano.
- **En la app, marcados como mayorista**:
  - en el mapa;
  - en Mismo producto, en un bloque aparte con "comprando el bulto de N";
  - en Tu lista, en una línea aparte;
  - en las promos.
- **Dónde no compiten**: titulares y ahorro de la portada, Más barato, Tu canasta, el índice de inflación y la gama. Comprar el bulto no es la compra de una persona, y Nini ganaría todos los titulares.
- Un interruptor `mayoristas_activos` en dbt: la ingesta empieza a cargar enseguida, y los mayoristas pasan a los marts recién cuando las pantallas están listas.
- Fuera de alcance: categorizar los ~13.700 productos que solo están en mayoristas (usa Gemini), guardar historia por sucursal, el perfil Comercio y las pantallas de Changuito Empresas.

## Capabilities

### New Capabilities
- `precios-mayoristas`: qué se baja y se guarda de SEPA mayoristas, con qué detalle y unidad, cómo se identifica a un mayorista y cómo se completa su ubicación.

### Modified Capabilities
- `mismo-producto`: los mayoristas aparecen aparte, con el precio comprando el bulto, y no cuentan para la más barata, la más cara ni la brecha.
- `tu-lista`: una línea aparte por mayorista cerca, fuera de los totales.
- `zona-del-usuario`: un mayorista cerca se lista aparte y no cuenta como cadena de la zona.
- `promos`: las promos de mayoristas se ven, marcadas.
- `portada`: los titulares y el ahorro no usan mayoristas.
- `mas-barato`: la vista nacional usa solo las cadenas de súper de Mismo producto.
- `inflacion`: el índice mide solo cadenas de súper.

## Impact

- **Ingesta** (`orquestacion/scripts/`): `descargar_sepa.py` y `cargar_datos.py` toman el dataset como parámetro; `ingesta_backfill.py` baja los dos por fecha, ajusta la retención de los dos crudos y recupera fechas de mayoristas que faltan. Pruebas nuevas sobre el modelo de `test_ingesta_backfill.py`.
- **dbt**: fuente nueva y unión en `stg_productos`, `mart_mismo_producto` y `mart_promos_evidencia`; `compite_en_rubro` corregida para que solo una farmacia compita en sus rubros; filtros de formato en gama, cambio de precio y brecha; seed de coordenadas; `unidades_bulto` hasta `mart_mismo_producto`.
- **API**: marca `mayorista` y unidades por bulto en Mismo producto, en zonas, en el mapa y en promos, siguiendo el camino de farmacia.
- **Frontend**: bloque de mayoristas en Mismo producto, línea en Tu lista, marcador y etiqueta en mapa y promos, "mayoristas cerca" en el selector de zona.
- **BigQuery**: +0,3 GiB de almacenamiento (de 7,18 a ~7,5 de 10 GiB gratis) y ~+0,3 GiB de consultas por día (~10 GiB por mes; noviembre va en 322 de 1024). Las cargas no gastan cuota. Sigue en el uso gratuito.
- **Informe final** con mayoristas, sucursales, productos, unidades y costo antes y después, en `docs/DECISIONES.md`.
