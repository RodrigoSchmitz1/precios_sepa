# Tasks

## 1. API: lugares con cadenas y ranking por zona

- [x] 1.1 Sumar a `mapa_promos.lugares` la lista de cadenas con sucursal en cada lugar y exponer `/zonas`; verificar con un test en `api/` que un lugar armado a mano devuelve sus cadenas sin repetir y que `/promos/lugares` no cambia
- [x] 1.2 Calcular quién gana por categoría entre un conjunto de cadenas desde el índice de Mismo producto con las reglas de `mart_quien_gana` (productos con al menos 2 de las cadenas, mínimo 20 productos ofrecidos por cadena y categoría, empates para todas, sin filtro de precio creíble) y exponerlo en `/quien-gana/zona`; verificar con tests de casos a mano (empate, cadena con menos de 20, cadena fuera del conjunto que no cuenta) y que una lista vacía o sin ninguna cadena con precios responde 422, mientras que una cadena sin precios ese día se ignora
- [x] 1.3 Medir contra producción, sin cuota, que con todas las cadenas el ganador de cada categoría de `/quien-gana/zona` coincide con `mart_quien_gana`; dejar la coincidencia medida y la tolerancia en un test de oráculo o, si difieren, documentar por qué en docs/DECISIONES.md

## 2. Estado de zona en el frontend

- [x] 2.1 Crear el estado compartido de zona (proveedor en `Layout`) con lectura y escritura en localStorage protegidas con try/catch; verificar con Vitest (jsdom) que guarda, recupera y sigue andando si localStorage tira excepción
- [x] 2.2 Reflejar la zona en la URL como `?zona=<provincia>:<nombre>` conservando los demás parámetros, con la URL ganando sobre localStorage al cargar y descartando con aviso una zona desconocida; verificar con tests de la función que lee y arma la URL (`?q=` y `?c=` intactos, nombre con tildes y espacios, zona inexistente)
- [x] 2.3 Implementar "usar mi ubicación" eligiendo el lugar más cercano en el navegador; verificar con un test del cálculo de cercanía (Palermo contra Belgrano, punto en el límite) y con el mensaje cuando el permiso se rechaza

## 3. Selector de zona en el encabezado

- [x] 3.1 Agregar el botón de zona al encabezado y el panel con buscador sin tildes, homónimos con provincia, "usar mi ubicación" y "borrar zona"; verificar en WebKit a 414 px (Playwright) que el panel entra sin desplazamiento horizontal, que el campo mide 16 px y que buscar "nunez" ofrece "Núñez, CABA"
- [x] 3.2 Verificar en WebKit que la zona elegida se ve en el encabezado de las seis páginas y que borrarla las devuelve a todo el país

## 4. Páginas que usan la zona

- [x] 4.1 Mismo producto: separar "en tu zona" del resto, titular con la más barata de la zona y el porcentaje contra la más cara, caso sin ninguna cadena de la zona, y aclaración fija de que el precio es de la cadena; verificar con un test de la función que parte y ordena las cadenas y con el recorrido en WebKit
- [x] 4.2 Buscador del inicio: la búsqueda llega a Mismo producto con la zona; verificar con el recorrido en WebKit inicio → elegir "Rosario, Santa Fe" → buscar "aceite natura" → Mismo producto con la zona aplicada
- [x] 4.3 Promos: abrir el mapa en el centro de la zona y que mover el mapa no cambie la zona; verificar en WebKit que la lista arranca con promos de la zona y el encabezado no cambia al arrastrar
- [x] 4.4 Tu canasta: agregar la zona como localidad solo sin localidades guardadas y si es cotizable, con aviso si no lo es; verificar con un test de la regla y en el navegador con una canasta guardada que conserva sus localidades
- [x] 4.5 Más barato: vista de la zona con `/quien-gana/zona`, cambio a todo el país y caso de una sola cadena; verificar en WebKit con Palermo (sin Maxi entre los ganadores) y con una localidad de una sola cadena
- [x] 4.6 Inflación: aclaración de que es nacional cuando hay zona; verificar en el navegador con y sin zona
- [x] 4.7 Documentar en docs/DECISIONES.md la zona compartida, por qué el precio de un producto sigue siendo el de la cadena y por qué el ranking de zona se recalcula en la API; verificar que los links internos del documento resuelven

## 5. Integración

- [x] 5.1 Correr tests de API y frontend, tsc y eslint, y el barrido de WebKit a 414 px de las seis páginas con y sin zona (sin desborde ni errores de consola); verificar que todo pasa
- [x] 5.2 Validar el cambio con `openspec validate zona-compartida --strict` y verificar que no hay errores ni advertencias

## Workflow follow-up

- Mostrar el resultado a Rodrigo antes de commitear; desplegar solo con su OK.
- Archivar el cambio (`/openspec-archive-change`) después del deploy, para que las specs pasen a `openspec/specs/`.
