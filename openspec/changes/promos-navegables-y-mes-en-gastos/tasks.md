# Tasks

## 1. API: vidriera y filtros en memoria

- [x] 1.1 Sumar `id_producto` a las filas de promo (`_fila` en `api/mapa_promos.py`); verificar con un test que `/promos/mapa` lo devuelve y que los tests de mapa existentes siguen pasando.
- [x] 1.2 Agregar el parámetro `rubro` a `buscar` y a `/promos/mapa`; verificar con un test que con `rubro=Limpieza` solo vuelven promos de Limpieza y que sin él no cambia nada.
- [x] 1.3 Escribir `vidriera(indice, latitud, longitud)` en `mapa_promos.py` con las constantes de promo fuerte (evidencia `leyenda`/`mercado`, sin compra múltiple, vigente, 2+ sucursales primero, un producto una vez, `MAXIMO_POR_CADENA_FUERTES = 3`), filas por rubro y por cadena (sin farmacias) y `poco_informan`; verificar con tests: crema al 70 % en 1 sucursal contra aceite al 35 % en 8, 2x1 afuera, Carrefour con 10 promos máximas da 3, farmacia sin fila, sin zona usa todo el país.
- [x] 1.4 Exponer `GET /promos/vidriera` en `api/main.py` (coordenadas opcionales, sin `@cachear` con zona); verificar con un test de la API que responde sin llamar a `cliente_bq` y medir el tiempo con Palermo.
- [x] 1.5 Sumar la tarjeta de compartir de `/promos/:rubro` en `api/compartir.py`; verificar con un test en `api/test_compartir.py` que `/promos/limpieza` lleva título propio.
- [x] 1.6 Correr `api/venv/Scripts/python.exe -m unittest discover -p "test_*.py"` desde `api/` y ver todo en verde.

## 2. Frontend: vidriera y mapa a pedido

- [x] 2.1 Sumar `obtenerVidriera` y el parámetro `rubro` de `obtenerPromosMapa` en `api/client.ts`, y sus tipos en `types/index.ts`; verificar con `npm run build` sin errores de tipos.
- [x] 2.2 Sacar lista, orden, tandas y bloque de evidencia de `PromosPage` a `ListadoPromos`; verificar que la vista del mapa se ve igual que antes (mismo texto y orden) en el panel del navegador.
- [x] 2.3 Pasar la vista del mapa a un componente cargado con `React.lazy` que se abre con `?mapa=1`; verificar en el navegador que la portada no pide `/promos/mapa` ni carga Leaflet hasta tocar "Ver en el mapa", y que el link con `?mapa=1` lo abre de entrada.
- [x] 2.4 Armar la vidriera (promos fuertes, filas por categoría con "Ver todas" y "Ver todas las categorías", filas por súper, línea de los que casi no informan, invitación a elegir zona sin zona); verificar con un test de vitest con una respuesta de vidriera simulada y a 375 px en el navegador, sin scroll horizontal.
- [x] 2.5 Crear la página `/promos/:rubro` en `router.tsx` con `ListadoPromos`, subcategorías, buscador y estado vacío con vuelta a la vidriera; verificar con un test de vitest (lista y vacío) y en el navegador con Limpieza en Caballito.

## 3. Avisos de oferta

- [x] 3.1 Escribir `utils/avisos.ts` (leer, alternar, sacar, tope `MAXIMO_AVISOS = 50`, try/catch si no se puede guardar); verificar con tests de vitest para agregar, sacar, tope y almacenamiento bloqueado.
- [x] 3.2 Crear `BotonAvisame` (Avisame / Te avisamos / tope / no se puede guardar) y ponerlo en el detalle de producto y en `PromoCard` dentro de la página de categoría; verificar con un test de vitest que alterna y que en la vista del mapa no aparece.
- [x] 3.3 Crear el bloque de avisos al tope de la vidriera, que pide `obtenerPromosDeProductos` con los avisos y la zona: "N de tus avisos están de oferta cerca", línea chica si ninguno, invitación sin zona y lista para sacar avisos; verificar con un test de vitest para los tres estados y en el navegador.

## 4. Mis gastos: el mes contra 1 y 2 cadenas

- [x] 4.1 Escribir `utils/mesDeGastos.ts`: productos vinculados del mes sin gastos a mano, tope de 50 por importe, recortados, y la comparación contra las opciones de 1 y 2 sucursales con cobertura mínima; verificar con tests de vitest: Día más barata, ya compró en la más barata, mezclar no conviene, poca cobertura, solo gastos a mano.
- [x] 4.2 Mostrar el resumen del mes en `GastosPage` con `dondeComprarLista`, "a precio de lista y sin promos", qué llevar de cada cadena al mezclar e invitación sin zona; verificar sumando casos a `GastosPage.test.tsx` y mirándolo a 375 px en el navegador.

## 5. Cierre

- [x] 5.1 Correr `npm run test`, `npm run lint` y `npm run build` en `frontend/` y ver todo en verde.
- [x] 5.2 Recorrer vidriera, categoría, mapa, avisos y Mis gastos en WebKit a 414x896 con el script de Playwright; verificar que no hay desbordes ni errores de consola.
- [x] 5.3 Anotar en `docs/DECISIONES.md` la vidriera (reglas de promo fuerte, por qué la arma la API, tiempo medido en Palermo) y el resumen del mes.

## Workflow follow-up

- Deploy con el OK de Rodrigo (hoy: sin gastar hasta pulir).
- Archivar el change y completar el propósito de `avisos-de-oferta` si quedó TBD.
- Diseñar aparte las señales anónimas para Changuito Empresas sobre `BotonAvisame` y las páginas de categoría.
