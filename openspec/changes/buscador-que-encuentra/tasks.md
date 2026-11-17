# Tasks

## 1. Búsqueda

- [x] 1.1 Agregar `fonetizar` y la partición en palabras a `api/mismo_producto.py`, con tests de casos chicos: yerva/yerba, aseite/aceite, 1.5l, ch.
- [x] 1.2 En `armar_indice`, precalcular `_palabras`, `_palabras_visibles` y `_palabras_categoria`.
- [x] 1.3 En `buscar`, cambiar la coincidencia a prefijo de palabra con plural y fonética, y el orden a la clave por niveles del design.
- [x] 1.4 Revisar `TestBuscar` y los demás usos de `_texto`. Ajustar sin perder casos: "Café morenita", tamaños "500g" y "1kg", "yerba nescafe" vacío.

## 2. Pruebas con casos reales

- [x] 2.1 Test `api/test_buscador.py` con filas de prueba que reproducen los casos medidos:
  - "leche": Leche fluida primero, Kinder y Cofler después;
  - "huevos": la categoría Huevos antes que Kinder;
  - "pan": sin empanada, con Pan antes que pan rallado y el pañal al final;
  - "yerva" igual a "yerba";
  - "gall" encuentra galletitas;
  - "fideos" sigue igual.
- [x] 2.2 Correr las 20 búsquedas medidas contra la API local, con el índice real, y comparar el antes y el después. Anotar el resultado en `docs/DECISIONES.md`.
- [x] 2.3 Correr la suite completa de la API con `SIN_BIGQUERY=1`, incluido el test de rendimiento del peor caso.

## 3. Verificación en la página

- [x] 3.1 En WebKit a 414x896, buscar "leche" desde el inicio y confirmar que los primeros resultados de Mismo producto son leches.
