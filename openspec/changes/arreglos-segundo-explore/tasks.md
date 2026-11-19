# Tasks

## 1. API

- [x] 1.1 `mismo_producto.buscar` normaliza las unidades escritas; tests: "1 litro", "2 litros", "500 gramos", "1 kilo", "1,5 lts"
- [x] 1.2 `mapa_promos.lugares`
  - fusión por contención de palabras a menos de 2 km, con alias
  - centro recalculado
- [x] 1.3 Tests de la fusión
  - Laferrere ×3
  - José C. Paz con y sin punto
  - dos lugares a 3 km que no se juntan
  - provincias distintas que no se juntan
  - el mapa sin `con_cadenas` igual que antes
- [x] 1.4 Medir con la API local: zonas antes y después, y los pares fusionados

## 2. Frontend

- [x] 2.1 `utils/zona.ts`
  - `buscarZonas` por palabras, con alias
  - `zonaDeParametro` resuelve alias
  - `RADIO_CERCA_KM`
  - tests
- [x] 2.2 `utils/ejemploPortada.ts` y `Presentacion.tsx`: el ejemplo con las cadenas de la zona o "en todo el país"; tests
- [x] 2.3 `FilasDePrecios`: "N sucursales en el país" en el grupo de la zona
- [x] 2.4 `TuLista.tsx`: "Ninguna cadena cerca informa precio de…", y barrer el resto del frontend
- [x] 2.5 `utils/opcionesCompra.ts` y `DondeComprarla.tsx`
  - mejor por cobertura y costo
  - "contra una sola" solo con la misma cobertura
  - "Sin: X" en cada opción incompleta
  - radios 1/3/5, con 3 de inicio
  - tests
- [x] 2.6 Lint, `tsc -b`, `vitest` y `build`

## 3. Verificación y docs

- [x] 3.1 E2E en WebKit a 375 y 414 px
  - "leche la serenisima 1 litro" trae resultados
  - "lomas zamora" encuentra la zona
  - "laferrere" da una opción
  - un link con "Gregorio Laferrere" abre la zona
  - la portada con Palermo sin La Anónima en el ejemplo
  - "en el país" en la zona
  - Tu lista con "informa precio"
  - el paso 4 en Lomas con 3 km y el Maxi
  - sin desborde
- [x] 3.2 Regresivos: Tu lista con zona, Tu canasta, cadenas cerca, formatos, compartir y el barrido
- [x] 3.3 `docs/DECISIONES.md`: sección "Arreglos del segundo explore" con lo medido. README si cambian los conteos
- [x] 3.4 `openspec validate arreglos-segundo-explore --strict`
