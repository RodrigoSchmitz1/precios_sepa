# Tasks

## 1. API

- [x] 1.1 Guardar `id_producto` y el índice por producto en `IndiceMapa` (`api/mapa_promos.py`).
- [x] 1.2 Leer `vigente_hasta` de la leyenda y descartar las promos vencidas según la fecha de la Argentina.
- [x] 1.3 Agregar `promos_de_productos(indice, ids, latitud, longitud)`: promos a menos de `RADIO_PROMOS_KM`, la sucursal más cercana, cuántas más hay cerca, ordenadas por precio y hasta 3 por producto.
- [x] 1.4 Exponer `GET /api/promos/productos` en `api/main.py`, con un tope de 100 ids.
- [x] 1.5 Tests en `api/test_promos_productos.py`: radio, orden, tope, vencidas, leyendas sin fecha, producto sin promos y validación de parámetros.
- [x] 1.6 Medir la memoria del índice del mapa con las filas reales, antes y después del cambio.

## 2. Frontend

- [x] 2.1 Agregar el tipo y la función de la API (`types`, `api/`).
- [x] 2.2 Crear `utils/promosCerca.ts` con `promosQueConvienen` y el formato de la vigencia, más sus tests.
- [x] 2.3 En Tu lista, con zona: la mejor promo que conviene debajo de cada producto y la línea "N productos de tu lista están en promo cerca"; sin zona, la invitación a elegirla. Si el pedido falla, sin promos.
- [x] 2.4 En el detalle, con zona: el bloque "En promo cerca tuyo" con hasta 3 promos.
- [x] 2.5 Agregar tests de componente para Tu lista con y sin zona, y para el detalle.

## 3. Verificación y documentación

- [x] 3.1 Correr los tests de la API y del frontend, lint, `tsc -b` y `build`.
- [x] 3.2 Probar de punta a punta en local, en WebKit a 414 px: Palermo con Levité, Lomas sin promos que convengan, sin zona y el detalle de Cocinero en Caballito.
- [x] 3.3 Agregar a `docs/DECISIONES.md` la regla de qué promo se muestra, el radio, la vigencia y por qué el total no las incluye, con las cifras medidas.
- [x] 3.4 Actualizar los conteos de tests del README.

## Workflow follow-up

- Commit y push cuando Rodrigo lo pida.
- Deploy con su OK, y después revisar en producción con tráfico: logs de memoria y errores.
- Archivar el change y publicar la spec.
