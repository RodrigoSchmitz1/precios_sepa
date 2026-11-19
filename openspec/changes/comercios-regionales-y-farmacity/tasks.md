# Tasks

## 1. Ingesta y seed

- [x] 1.1 Sumar 5, 6, 8, 20, 21, 24 y 47 a `COMERCIOS_OBJETIVO` (`descargar_sepa.py`) y a `COMERCIOS` (`cargar_datos.py`), con un comentario que explique por qué quedan afuera las estaciones de servicio
- [x] 1.2 Agregar a `seeds/mapeo_cadenas.csv` las banderas nuevas con su nombre comercial (Toledo, Supermercados Comodín, Maxi Comodín, Mariano Max, California, La Agrícola Regional, Unicoop, Farmacity, Simplicity) y las columnas `formato` e `informe_diario`
- [x] 1.3 Propagar `formato` e `informe_diario` en `stg_comercio`, con default supermercado/true, y documentarlas en `_staging.yml`

## 2. dbt

- [x] 2.1 Variable `rubros_farmacia` y macro `compite_en_rubro`, con unit test (mart_quien_gana) y el test de datos `farmacia_solo_en_sus_rubros`
- [x] 2.2 Llevar `formato` en `int_precio_producto_cadena` y `mart_mismo_producto`
- [x] 2.3 Filtrar con `compite_en_rubro` en `mart_quien_gana` y `mart_precios_cadena_categoria`
- [x] 2.4 Excluir farmacias en `mart_precio_categoria_localidad` y `mart_precio_categoria_sucursal`
- [x] 2.5 Llevar `formato` en `mart_mapa_sucursales`
- [x] 2.6 `cadenas_del_ultimo_dia_completas` ignora los comercios con `informe_diario = false`, con el caso medido en el comentario
- [x] 2.7 Probar sin tocar producción: modelos vacíos (`--empty`, 0 bytes) y tests unitarios en el dataset `dbt_prueba_comercios`, y `dbt seed` sin full refresh con las columnas nuevas. Los tests de localidad, promos y categorización con datos reales corren en la primera corrida después del deploy (5.1 a 5.3)

## 3. API

- [x] 3.1 `/zonas`: `cadenas` solo con supermercados y `farmacias` aparte (`mapa_promos.py`), con tests
- [x] 3.2 El índice de El mismo producto lleva `formato` por precio, y `cotizar_lista` excluye farmacias de totales, más barata y combinación, con tests
- [x] 3.3 Estimar el índice en memoria con los ZIP: +13.400 filas de precio sobre ~205.000 (+6,5%); medir de verdad en producción tras la primera corrida

## 4. Frontend

- [x] 4.1 Nombres en `utils/nombres.ts` (Comodín, La Agrícola Regional, etc.)
- [x] 4.2 "farmacia" junto al nombre en las filas de precios del detalle, y la zona del detalle con `cadenas + farmacias`, con tests
- [x] 4.3 Tipos de `Zona` con `farmacias` opcional

## 5. Verificación y documentación

5.1 a 5.3 se hacen en producción, después del deploy y de la primera corrida con los comercios nuevos (E2E en el scratchpad: comercios_e2e.py).

- [ ] 5.1 Correr la categorización de los productos nuevos y verificar que no quedan productos sin categoría en los marts
- [ ] 5.2 Medir Más barato nacional con los regionales: que ninguna cadena chica gane con poca muestra
- [ ] 5.3 E2E en WebKit a 375 y 414 px: Mar del Plata con Toledo, una zona con Farmacity cerca (cuenta de cadenas, Tu lista sin Farmacity, shampoo con Farmacity)
- [x] 5.4 Tests (API, frontend, lint, tsc, build) y DECISIONES.md con lo medido; README con las cadenas y los conteos de tests
