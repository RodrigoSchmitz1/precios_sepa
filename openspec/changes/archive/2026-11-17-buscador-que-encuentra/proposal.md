# Proposal

## Why

El buscador de Mismo producto es la entrada principal del sitio, y para las
búsquedas más comunes devuelve otra cosa. Lo encontró el explore externo del
2026-11-17. Medido el mismo día contra el índice de producción, con 20
búsquedas de la compra diaria:

- **"leche":** los 8 primeros resultados son Águila, Actimel, arroz con leche,
  Kinder, Cofler y Cindor. Ninguno es una leche.
- **"huevos":** el primero es el huevo Kinder.
- **"azucar":** trae Coca Cola, Schweppes y Nido, y ningún azúcar.
- **"pan":** trae mantecas, pañuelos, rollos de cocina y tapas de empanada.
- **"yerva":** no trae nada.

Hay tres causas en `buscar` (`api/mismo_producto.py`):

1. Busca pedazos de texto en lugar de palabras. "pan" encuentra "em**pan**ada"
   y "**pan**al" (pañal sin tilde).
2. Ordena solo por la cantidad de cadenas que venden el producto y después
   alfabéticamente, sin mirar si el producto es lo que se buscó. Casi todos los
   productos están en 13 o 14 cadenas, así que en la práctica el orden queda
   alfabético.
3. No tolera errores de ortografía comunes (b/v, s/z, y/ll).

Las búsquedas que ya andan bien ("fideos", "cafe", "detergente", "fernet")
tienen que seguir igual.

## What Changes

- **Palabras, no pedazos:** cada palabra buscada tiene que coincidir con el
  comienzo de una palabra del producto. "gall" sigue encontrando "galletitas" y
  "pan" deja de encontrar "empanada". Se tolera el plural: "huevos" encuentra
  "HUEVO".
- **Ortografía:** se tratan como iguales la b y la v, la s, la z y la c suave
  (ce, ci), la y y la ll, y la h muda. Así "yerva" encuentra yerba.
- **Lo buscado va primero:** los resultados se ordenan por relevancia antes que
  por la cantidad de cadenas:
  1. Primero, los productos cuya categoría coincide con lo buscado: "leche"
     encuentra Leche fluida.
  2. Después, los productos cuya descripción visible tiene las palabras, antes
     que los que solo las tienen en el nombre que usa otra cadena.
  3. A igualdad, más cadenas y una descripción más corta.
- La respuesta de `/mismo-producto/buscar` no cambia de forma. El frontend no se
  toca.

## Capabilities

### New Capabilities

Ninguna.

### Modified Capabilities

- `mismo-producto`: suma los requisitos de la búsqueda de productos. Hoy la spec
  solo dice que la búsqueda del inicio conserva la zona.

## Impact

- **`api/mismo_producto.py`:**
  - `armar_indice` precalcula las palabras normalizadas de cada producto, las de
    su descripción visible y las de su categoría.
  - `buscar` cambia la coincidencia y el orden.
- **Tests:** `api/test_mismo_producto.py` (`TestBuscar`) y un test nuevo con las
  20 búsquedas medidas, que usa filas de prueba en lugar del índice real.
- **Dónde se usa:** `/mismo-producto/buscar` sirve al buscador del inicio, al de
  Mismo producto y a los ejemplos de la página. Todos mejoran con el cambio y
  ninguno cambia de forma.
- **Costo:** cero BigQuery, porque el índice ya está en memoria. La búsqueda
  recorre los productos igual que hoy.
