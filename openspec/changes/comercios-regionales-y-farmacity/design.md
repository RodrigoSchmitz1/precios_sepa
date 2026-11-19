# Design

## Context

- **La ingesta** baja el ZIP diario de SEPA minoristas, pero extrae solo los `comercioId` de `COMERCIOS_OBJETIVO` (2, 9, 10, 11, 12, 13, 15 y 16). El 16 es Libertad, que en la semana medida no vino nunca.
- **La medición** usó los 7 ZIP del 13 al 19 de noviembre, procesados en la PC, sin BigQuery. Los ZIP se bajaron enteros porque el portal no acepta descargas parciales. Cada ZIP trae entre 17 y 18 comercios:

| id | Comercio | Banderas (id) | Sucursales | Días en la semana |
|---|---|---|---|---|
| 5 | California S.A. | California Supermercados (1) | 7 | 7/7 |
| 6 | Alberdi S.A. | Supermercados Comodin (1), Maxi Comodin (2) | 26 | 7/7 |
| 8 | Mariano S.A. | Mariano Max (1) | 11 | 7/7 |
| 20 | La Agrícola Regional Coop. | (1) | 4 | 5/7 |
| 21 | Supermercados Toledo | Toledo (1) | 28 | 7/7 |
| 24 | Farmcity S.A. | SIMPLICITY (1), FARMACITY (2) | 335 | 6/7 |
| 47 | Coop. Patagones y Viedma | Sup. Unicoop (1) | 3 | 7/7 |
| 3, 4, 23 | Deheza, Estación Lima, Axion | estaciones de servicio | 96 | sin cambio |

Los 36 llegan vacíos.

- **El nombre de cada cadena** sale de `seeds/mapeo_cadenas.csv`, por comercio y bandera. Si una bandera no está en el seed, se usa el nombre crudo.
- **La empresa** es `MIN(id_comercio)` en `int_precio_producto_cadena`.
- **El arrastre de una cadena que falta** se resuelve en `mart_mismo_producto`, con `dias_maximos_arrastre = 2`.
- **El control `cadenas_del_ultimo_dia_completas`** lee la tabla intermedia y falla si falta una cadena que el día anterior tenía más de 1.000 productos. Farmacity tiene unos 1.950 y La Agrícola unos 3.300, así que lo romperían los días que faltan.

## Goals / Non-Goals

**Goals:**
- Sumar los seis regionales como cadenas plenas y Farmacity como farmacia, sin gastar fuera del plan gratuito.
- Que una sola regla diga dónde compite una farmacia, y que dbt, la API y los textos la lean del mismo lugar.
- Que un comercio intermitente no ponga el pipeline en rojo, sin aflojar el control para las cadenas grandes.

**Non-Goals:**
- SEPA mayoristas, tiendas online u otras fuentes.
- Rehacer la historia: los comercios nuevos entran desde el día del deploy, porque el crudo viejo ya expiró.
- Una página o vista propia para farmacias.

## Decisions

1. **Formato en el seed.** `mapeo_cadenas.csv` suma dos columnas:
   - `formato`: `supermercado` o `farmacia`;
   - `informe_diario`: `true` o `false`, false para los comercios 20 y 24.

   `stg_comercio` las propaga, y una bandera que no esté en el seed queda como supermercado con informe diario. Se descartaron:
   - **una lista fija en el código:** repetiría lo mismo en la ingesta, en dbt y en la API;
   - **deducir el formato por el surtido:** es frágil y cambia día a día.
2. **Los rubros de la farmacia viven en un solo lugar.** Una variable de dbt, `rubros_farmacia: ['Higiene', 'Bebes']`, y una macro `compite_en_rubro(formato, rubro)`. La usan `mart_quien_gana`, `mart_precios_cadena_categoria` y, por herencia, los históricos. La API no la repite: lee lo que ya filtró el mart.
3. **La comparación del mismo producto incluye la farmacia.** `int_precio_producto_cadena` y `mart_mismo_producto` llevan `formato` por cadena. La API lo pasa en cada precio, y el frontend agrega "farmacia" junto al nombre. La brecha y los extremos del producto la incluyen: es el mismo código de barras.
4. **Las cadenas cerca son solo supermercados.**
   - `mart_mapa_sucursales` lleva `formato`.
   - En `/zonas`, `cadenas` sigue siendo la lista que todas las páginas usan para comparar, ahora solo con supermercados, y se agrega `farmacias`.
   - El detalle del producto usa `cadenas + farmacias` para la sección de la zona.
   - Tu lista cotiza con `cadenas` y además excluye por formato en `cotizar_lista`, por si la llaman sin zona.
5. **Tu canasta excluye las farmacias** en `mart_precio_categoria_localidad` y `mart_precio_categoria_sucursal`, filtrando por `formato = 'supermercado'`.
6. **El control intermitente.** `cadenas_del_ultimo_dia_completas` ignora las cadenas cuyo comercio tiene `informe_diario = false`. `arrastre_dentro_del_tope` no cambia, así que un comercio que falte más de 2 días deja de mostrarse en lugar de mostrar un precio viejo. La alternativa de bajar la severidad a warn se descartó, porque un warn no lo lee nadie (ver el propio test).
7. **La ingesta.** `COMERCIOS_OBJETIVO` y `COMERCIOS` suman 5, 6, 8, 20, 21, 24 y 47. Libertad (16) queda en la lista: no molesta y vuelve sola si SEPA la publica de nuevo.

## Risks / Trade-offs

- **Memoria del índice en Cloud Run (1 GiB).** El mart de El mismo producto pasa de unos 47.800 productos a unos 59.000. Hay que medir el índice en memoria antes del deploy y revisar los logs de "Memory limit" con tráfico.
- **Primera categorización.** Son unos 11.000 productos nuevos, unos 220 lotes de Gemini, en la primera corrida diaria (con 4 hilos, alrededor de una hora). Si algún lote falla, se reintenta solo cuando el producto vuelva a aparecer. Correrla a mano una vez antes es más seguro.
- **Más barato nacional con cadenas chicas.** Un regional con pocos productos podría "ganar" una categoría nacional con poca muestra. Hay que verificar con datos que los mínimos de muestra de `mart_quien_gana` lo impiden, y ajustarlos si hace falta.
- **Promos de Toledo.** Es el único regional que informa promos, unas 1.600 filas. La calibración de promos es por cadena y tiene el test `calibracion_de_promos_con_muestra_suficiente`. Hay que verificar que una cadena con muestra chica no lo rompa ni publique promos sin calibrar.
- **Coordenadas y provincias.** Comodín trae sucursales sin provincia. La provincia por coordenadas que ya existe lo cubre, pero conviene verificarlo con los tests de localidad.
- **Cuota.** Son +4% de filas, unos 0,5 GiB más por día de pipeline, sobre unos 405 GiB por mes. El crudo guardado pasa de 4,17 a unos 4,3 GiB. Sigue dentro del plan gratuito.
