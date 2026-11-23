# Proposal

## Why

Mi lista y Tu canasta responden la misma pregunta, "¿dónde me sale más barata la compra?", con dos niveles de detalle: productos exactos y categorías. Tenerlas separadas confunde. Además, en los registros del último mes, Tu canasta la abrieron unas 9 personas y solo 3 la completaron con la IA. Mi lista es más concreta y más creíble (el precio es el de ese producto, no una mediana de categoría) y es la que se conecta con Mis gastos. Conviene una sola sección, "Mi compra", con Mi lista como base y lo útil de Tu canasta adentro.

## What Changes

- La página `/lista` pasa a llamarse **Mi compra**, y "Mi compra" reemplaza a "Mi lista" en la barra del celular y en el menú de la computadora. El acceso del encabezado sigue igual.
- **Armar la lista describiendo el hogar:** "Contanos quiénes viven en tu casa" usa la misma IA de Tu canasta para proponer categorías y cantidades, y la persona elige la marca de cada una con un toque. Lo elegido se suma a la lista. También se puede empezar desde la canasta básica del INDEC.
- **Dónde comprarla cerca:** con una zona elegida, Mi compra muestra la mejor forma de comprar la lista en 1, 2 o 3 cadenas con sucursal cerca, con la sucursal más cercana de cada una en un mapa. Usa el precio de cada cadena para todo el país, como el resto de la lista, y lo dice.
- **BREAKING:** se retira la página Tu canasta. `/canasta-personalizada` lleva a Mi compra, y si el navegador tenía una canasta guardada, Mi compra ofrece elegir las marcas de esa canasta para pasarla a la lista. Tu canasta sale de la hoja "Más", de la portada, de Cómo se calcula y de la página de no encontrada.
- El bloque "De tu canasta" de Mismo producto se muda a Mi compra.

Fuera de alcance: cambiar la tarjeta de ahorro de la portada (sigue usando la canasta básica), los endpoints de categorías de la API que ya no se usen (se limpian en otro change) y cualquier cambio de Mis gastos.

## Capabilities

### New Capabilities
<!-- Ninguna: Mi compra crece dentro de tu-lista. -->

### Modified Capabilities
- `tu-lista`: la página se llama Mi compra; la barra dice "Mi compra"; se suman armar la lista describiendo el hogar o desde la canasta básica, dónde comprarla cerca y pasar una canasta guardada a la lista.
- `tu-canasta`: se retiran sus requisitos junto con la página.

## Impact

- **Frontend:** `ListaPage.tsx` (título, armado con IA, dónde comprarla), `utils/secciones.ts` (barra y hoja "Más"), `router.tsx` (redirección), `Presentacion.tsx`, `ComoSeCalculaPage.tsx`, `NoEncontradaPage.tsx`, `MismoProductoPage.tsx` (sale "De tu canasta"); se borran `CanastaPersonalizadaPage.tsx` y los componentes que solo usaba ella; `DeTuCanasta.tsx` y `DondeComprarla.tsx` se adaptan.
- **API:** endpoint nuevo `POST /api/mismo-producto/lista/donde-comprar`, que reusa `optimizar_compra` con el precio de cada cadena y las sucursales del índice del mapa, ya en memoria. Sin consultas a BigQuery.
- **Docs:** `docs/DECISIONES.md`.
