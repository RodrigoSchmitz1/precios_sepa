# Proposal

## Why

Hoy el pipeline carga 8 de los 17 o 18 comercios que publica SEPA minoristas cada día. Se midió la semana del 13 al 19 de noviembre, con los ZIP procesados en la PC y sin BigQuery. Afuera quedan seis supermercados regionales y Farmacity. Son el 4% de las filas, unas 540.000 por día, con un costo de cuota despreciable: alcanza el plan gratuito. Pero en sus ciudades agregan una cadena más para comparar. Rodrigo prioriza las ciudades grandes fuera de CABA, donde la app gana valor antes de salir a difundirla. Farmacity, además, es la referencia de precio nacional en higiene y perfumería, que importa para el futuro producto para marcas.

## What Changes

- **Se cargan seis supermercados regionales:**

  | Comercio | Ciudad | Sucursales |
  |---|---|---|
  | Toledo | Mar del Plata | 28 |
  | Supermercados Comodín / Maxi Comodín | Jujuy | 26 |
  | Mariano Max | Córdoba | 11 |
  | California | Misiones | 7 |
  | La Agrícola Regional | Crespo, Entre Ríos | 4 |
  | Unicoop | Patagones y Viedma | 3 |

  Entran como una cadena más: comparan precios, cuentan como cadena cerca y compiten en Más barato, Tu lista y Tu canasta.
- **Se carga Farmacity / Simplicity** (335 sucursales en 17 provincias) como *farmacia*, que compite solo donde vende:
  - entra en la comparación del mismo producto y en Más barato en los rubros Higiene y Bebés;
  - no cuenta como cadena cerca;
  - no compite en los totales de Tu lista ni en Tu canasta.
- **Quedan afuera a propósito** las tiendas de estaciones de servicio (Axion, Deheza, Estación Lima). Tienen unos pocos cientos de productos y no aportan a una compra de supermercado.
- **Un comercio que no informa todos los días no pone el pipeline en rojo.** En la semana medida, Farmacity faltó un día y La Agrícola dos. Esos días se usa su precio más reciente, como ya se hace con cualquier cadena que falta.
- **Los nombres se escriben como cada marca:** Comodín, Unicoop y los demás.

## Capabilities

### New Capabilities

Ninguna.

### Modified Capabilities

- `datos-del-dia`: qué comercios de SEPA se cargan y cómo se controla un comercio que no informa todos los días.
- `zona-del-usuario`: una farmacia no cuenta como cadena cerca.
- `mismo-producto`: la farmacia compara sus productos pero no compite en los totales de Tu lista.
- `mas-barato`: la farmacia compite solo en sus rubros.
- `tu-canasta`: Tu canasta compara solo supermercados.

## Impact

- **Ingesta:** `COMERCIOS_OBJETIVO` en `orquestacion/scripts/descargar_sepa.py` y `COMERCIOS` en `cargar_datos.py`.
- **dbt:**
  - `seeds/mapeo_cadenas.csv`, con banderas nuevas y una columna de formato;
  - `stg_comercio`;
  - los marts que comparan cadenas (`mart_quien_gana`, `mart_precios_cadena_categoria`, `mart_precio_categoria_localidad`, `mart_precio_categoria_sucursal`, `mart_mapa_sucursales`);
  - el test `cadenas_del_ultimo_dia_completas`.
- **API:**
  - `/zonas` (cadenas cerca sin farmacias);
  - la cotización de Tu lista;
  - el tamaño del índice en memoria. Suma unos 11.000 productos, y el índice de Cloud Run hay que medirlo contra 1 GiB.
- **Frontend:** `utils/nombres.ts`, y mostrar la farmacia como farmacia donde aparece.
- **Categorización:** unos 11.000 códigos de barras nuevos pasan una vez por Gemini, unos 220 lotes en la primera corrida.
- **Cuota y almacenamiento:** +4% de filas sobre unos 7,2 GiB guardados y unos 405 GiB por mes. Sigue dentro del plan gratuito.
- **Sin cambios en inflación:** las series se encadenan por cadena y categoría, y solo entran las que tienen el mes completo. Una cadena nueva entra cuando cumple un mes, y una que falta algún día no entra. No hay salto de composición.
