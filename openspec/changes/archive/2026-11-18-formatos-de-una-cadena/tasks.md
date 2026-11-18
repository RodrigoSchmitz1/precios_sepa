# Tasks

## 1. Agrupar y nombrar

- [x] 1.1 `utils/formatosDeCadena.ts`: `FORMATO_DE`, `agruparFormatos` y `nombrarCadenas`, con tests:
  - mismo precio en dos formatos
  - precios distintos
  - Maxi no se agrupa
  - creíble y no creíble no se agrupan
  - fecha distinta no se agrupa
  - cambio de precio solo si coincide
  - nombres hasta 3 y "y N más"
- [x] 1.2 `MismoProductoPage.tsx`: `FilasDePrecios` pinta grupos; titular, extremos y "en todo el país" usan `nombrarCadenas`; se van las funciones locales
- [x] 1.3 Tests de componente de las filas agrupadas. Después, lint, `tsc -b`, `vitest` y `build`

## 2. Verificación y docs

- [x] 2.1 Medir en local sobre los 400 productos más comunes: filas antes y después, y que ningún precio mostrado cambie
- [x] 2.2 E2E en WebKit a 375 y 414 px
  - un producto con Changomás e HiperChangomás al mismo precio, en una fila
  - SuperChangomás aparte si cobra distinto
  - el titular sin "y 1 más"
  - sin desborde
  - con zona y sin zona
- [x] 2.3 `docs/DECISIONES.md`: sección "Formatos de una cadena", con por qué no se juntan las cadenas enteras. README si cambian los conteos
- [x] 2.4 `openspec validate formatos-de-una-cadena --strict`
