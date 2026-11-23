# Design

## Context

- `/lista` (`ListaPage.tsx`) ya tiene básicos, pegar una lista, compartir y la cotización por cadena con zona (`cotizar_lista`, precio de cada cadena para todo el país).
- Tu canasta (`CanastaPersonalizadaPage.tsx`, 879 líneas) cotiza por categoría con precios por sucursal (`mart_precio_categoria_sucursal`, ~490 mil filas en memoria). Sus piezas: localidades (hasta 3), IA que interpreta el hogar (`/canasta-personalizada/interpretar`, Gemini), canasta básica (`EmpezarConCanastaBasica`), comparación por cadena y "Dónde comprarla cerca" (`DondeComprarla.tsx` + `/canasta-personalizada/optimizar`, que reparte la compra entre 1, 2 o 3 sucursales con `optimizar_compra`).
- El puente entre las dos ya existe: `DeTuCanasta.tsx` toma ítems por categoría, ofrece las marcas más comunes (`/mismo-producto/sugeridos`) y calcula las unidades para el mes. Hoy vive en Mismo producto y lee la canasta guardada (`canastaGuardada.ts`).
- `optimizar_compra` es genérico: recibe ítems con clave y cantidad, y sucursales con `{clave: precio}`. No sabe de categorías.
- El índice del mapa (`mapa_promos`, ya en memoria) tiene todas las sucursales con cadena y coordenadas.

## Goals / Non-Goals

**Goals:**
- Una sola sección de compra, sin perder lo que la gente usaba de Tu canasta: la IA del hogar, la canasta básica y repartir la compra entre súper cercanos.
- No sugerir precisión por sucursal: en Mi compra todo es precio de cadena.

**Non-Goals:**
- Borrar endpoints de categorías de la API ni dejar de cargar `mart_precio_categoria_sucursal` (la portada y otras secciones pueden usarlo; se revisa en otro change).
- Cambiar Mismo producto más allá de sacar el bloque "De tu canasta".

## Decisions

### 1. Mi compra es `/lista` con otro nombre
Se conserva la ruta, la clave del navegador y los links compartidos (`/lista?l=…`). Cambian el título, la etiqueta de la barra ("Mi compra") y la del menú de la computadora. El acceso del encabezado (el changuito con el número) no cambia.
*Alternativa:* una ruta nueva `/compra`. Descartada: rompe los links de listas compartidas por WhatsApp sin ganar nada.

### 2. Armar con la IA reusa `interpretar` + `DeTuCanasta`
"Contanos quiénes viven en tu casa" llama al mismo `/canasta-personalizada/interpretar`, que ya convierte el 429 en "Probá de nuevo en un minuto". Las categorías que devuelve se muestran con `DeTuCanasta`, que ya elige marca y calcula unidades. La canasta básica usa `obtenerComposicionCanasta`, como `EmpezarConCanastaBasica`, y termina en el mismo selector. Una canasta guardada (`leerDelNavegador`) entra por el mismo camino. Al terminar o al tocar "Descartar", se borra con `borrarDelNavegador`.
*Alternativa:* que la IA elija la marca directamente. Descartada: la marca es la decisión de la persona y es lo que hace que el total sea su compra.

### 3. "Dónde comprarla cerca" con precio de cadena
Endpoint nuevo `POST /api/mismo-producto/lista/donde-comprar` con `{items, latitud, longitud, radio_km}`:
1. Sucursales de supermercado del índice del mapa dentro del radio (`sucursales_en_radio`), sin farmacias.
2. A cada sucursal se le asigna, por producto, el precio creíble de su cadena en el índice de Mismo producto. Todas las sucursales de una cadena quedan iguales, así que `optimizar_compra` las agrupa y se queda con la más cercana: en la práctica elige entre 1, 2 y 3 cadenas.
3. La respuesta tiene la forma que ya dibuja `DondeComprarla` (opciones con sucursales, subtotal e ítems), con el nombre del producto en vez de la categoría.
Mismo orden que Tu canasta: primero la cobertura y después el total. La distancia solo desempata. Radios 1, 3 y 5 km, arrancando en el radio de la zona (`RADIO_CERCA_KM`). Tope de 50 productos, el de la lista.
*Alternativa:* precios por sucursal de cada producto. No existen: SEPA da el precio de un producto exacto por cadena para todo el país (regla de honestidad del dato).

### 4. Qué se borra
Se borran `CanastaPersonalizadaPage.tsx` y los componentes que solo usaba ella (`CanastaPorCadena`, `ItemCanastaEditable`, `AgregarCategoria`, `LugaresDeCompra` y sus tests), después de confirmar con `grep` que nadie más los importa. `DondeComprarla` se adapta a productos. `/canasta-personalizada` pasa a ser una redirección que conserva el `search`. La tarjeta "Tu canasta" de la portada pasa a ser "Mi compra" y apunta a `/lista`.

## Risks / Trade-offs

- [Quien usaba localidades distintas de su zona pierde esa comparación] → Mi compra compara en la zona elegida, y la zona se cambia desde el encabezado. Eran pocos usuarios (3 completaron la canasta en un mes).
- [La IA del hogar elegía gama (económica, media) y Mi compra elige marca] → `DeTuCanasta` ordena por las más comunes y muestra el precio por kilo, que cumple la función de la gama.
- [Un archivo borrado que otro importaba] → `tsc -b` y la suite de tests fallan si queda una referencia; se corre antes de dar por hecha la tarea.
- [El índice del mapa no está cargado cuando llega el primer pedido] → se usa el mismo candado y la misma caché que las promos; la primera vez tarda lo que tarda el mapa.

## Migration Plan

Sin datos que migrar en el servidor. En el navegador, la canasta guardada se ofrece para pasar a la lista y después se borra. Vuelta atrás: el deploy anterior.
