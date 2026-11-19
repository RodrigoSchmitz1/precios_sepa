# Tasks

## 1. API

- [x] 1.1 `mapa_promos`
  - conteo de promos por sucursal de cada cadena al armar el índice
  - `POCAS_PROMOS_POR_SUCURSAL = 50`
- [x] 1.2 `mapa_promos.promos_de_lista`: la mejor sucursal por cadena, con promos vigentes sin compra múltiple, total con promos, total de lista, productos en promo y vigencia más corta
- [x] 1.3 `POST /api/promos/lista`: validación, precios de lista del índice de Mismo producto y `poco_informan`
- [x] 1.4 Tests
  - una sucursal con promos gana a otra de la misma cadena
  - 2x1 no cuenta
  - promo vencida no cuenta
  - cadena incompleta no compite
  - sucursal a más de 3 km no entra
  - `poco_informan`
  - validación del endpoint
- [x] 1.5 Medir el tiempo con 50 productos en Palermo (17 a 52 ms); la memoria del índice suma solo un dict por cadena

## 2. Frontend

- [x] 2.1 Cliente `obtenerPromosDeLista` y tipos
- [x] 2.2 `utils/promosDeLista.ts`: cuándo mostrar la línea y sus textos, y las cadenas que casi no informan; tests
- [x] 2.3 `TuLista.tsx`: la línea con zona, sin tocar el total de siempre
- [x] 2.4 Detalle: promos levantadas a la página; aviso bajo el titular si una promo cerca gana; tests
- [x] 2.5 Lint, `tsc -b`, `vitest` y `build`

## 3. Verificación y docs

- [x] 3.1 E2E en WebKit a 375 y 414 px
  - Tres Arroyos con una lista donde la Cooperativa Obrera gana con promos (Palermo quedó cubierto por la medición, no por el E2E)
  - Tres Arroyos con la Playadito y el aviso bajo el titular
  - una lista sin cambios, sin línea
  - las cadenas que no informan, nombradas
  - sin desborde
- [x] 3.2 Regresivos: Tu lista con zona, promos de tu lista, arreglos del segundo explore y el barrido
- [x] 3.3 `docs/DECISIONES.md`: sección "El total con las promos cerca" con lo medido. README si cambian los conteos
- [x] 3.4 `openspec validate total-con-promos-cerca --strict`
