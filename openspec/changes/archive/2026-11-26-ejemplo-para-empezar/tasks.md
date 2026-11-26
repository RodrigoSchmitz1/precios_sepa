# Tasks

## 1. Lista de ejemplo

- [x] 1.1 `utils/ejemploDeCompra.ts`: `elegirEjemplo(basicos)`, que toma los dos de más empresas por grupo y devuelve ítems con `grupo`, o vacío si quedan menos de 8 y la marca `changuito.lista.ejemplo.v1` con lectura y escritura envueltas en try/catch; test de vitest.
- [x] 1.2 `ProveedorLista`/contexto: cargar el ejemplo al abrir si corresponde (lista vacía, sin marca, sin `?l=`), exponer `esEjemplo`, `borrarEjemplo` y `quitarGrupo`, y pasar la marca a `"hecho"` en agregar, quitar, cambiar cantidad y vaciar; tests del proveedor (carga una vez, no vuelve tras borrar, tocar la convierte, sacar un grupo no la convierte, link con prioridad).
- [x] 1.3 `EjemploDeCompra` en `ListaPage` (cartel, borrar, chips por grupo) y link a Mis gastos al pie de `DondeComprarLista`; test de la página.

## 2. Mes de ejemplo en Mis gastos

- [x] 2.1 `utils/gastosDeEjemplo.ts`: 7 gastos del mes con básicos reales, 3 cadenas y 2 promos; test (totales coherentes, ids `ejemplo-`, nada en localStorage).
- [x] 2.2 `GastosPage`: mostrar el ejemplo con cero gastos, el cartel con "Borrar el ejemplo y empezar", que desaparezca con el primer gasto real, y que presupuesto, Excel, compra habitual, informe y racha usen solo los reales; tests en `GastosPage.test.tsx`.

## 3. Portada y verificación

- [x] 3.1 `TarjetaTuLista` con `esEjemplo`: título "Mirá cuánto ahorrás en tu compra" y aclaración; test.
- [x] 3.2 Correr tsc, eslint, vitest y build; recorrer portada → Mi compra → Mis gastos en el preview local a 375 px (sin desbordes). La pasada con WebKit queda para antes del deploy.
