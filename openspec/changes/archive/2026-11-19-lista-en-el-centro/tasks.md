# Tasks

## 1. API

- [x] 1.1 `BASICOS` y `basicos(indice)` en `api/mismo_producto.py`: unos 40 básicos en 6 grupos, resueltos con `buscar`
- [x] 1.2 `GET /api/mismo-producto/basicos` con `@cachear`, declarado antes de `/{id_producto}`
- [x] 1.3 Tests: devuelve el primer resultado por búsqueda, saltea las que no traen nada, conserva el orden y los grupos

## 2. Frontend

- [x] 2.1 `Layout.tsx`: barra del celular con "Mi lista" (`/lista`) y contador en lugar de Inflación; el menú de la computadora sin cambios
- [x] 2.2 Cliente `obtenerBasicos` y tipo
- [x] 2.3 `ArmadoRapido.tsx`: grupos, botones que suman y sacan, `aria-pressed`; tests de componente
- [x] 2.4 `ListaPage.tsx`: armado primero si la lista está vacía, plegado "Sumar básicos" si tiene productos
- [x] 2.5 `Presentacion.tsx`: tarjeta de tu lista debajo del buscador, con zona o país; tests
- [x] 2.6 Lint, `tsc -b`, `vitest` y `build`

## 3. Verificación y docs

- [x] 3.1 E2E en WebKit a 375 y 414 px
  - barra con "Mi lista" y contador
  - `/inflacion` sigue andando
  - lista vacía: sumar y sacar básicos
  - con productos: plegado
  - portada con lista y zona: la tarjeta
  - sin desborde
- [x] 3.2 Regresivos: Tu lista con zona, promos, el total con promos y el barrido
- [x] 3.3 `docs/DECISIONES.md`: sección "La lista en el centro". README si cambian los conteos
- [x] 3.4 `openspec validate lista-en-el-centro --strict`
