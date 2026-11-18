# Tasks

## 1. Control de cantidades

- [x] 1.1 `utils/cantidad.ts` con `mostrarCantidad` y `leerCantidad`, con tests: coma, punto, decimales, vacío, negativo, texto
- [x] 1.2 `ItemCanastaEditable.tsx`
  - el control no se encoge
  - campo de texto con `inputMode="decimal"`, aplicado al perder el foco o con Enter
  - "kg / mes" baja de línea antes de recortar
- [x] 1.3 Test de componente: tipear "3.5" y "3,5", "+" y "−"

## 2. Paso 4 en la zona

- [x] 2.1 `DondeComprarla.tsx`: punto inicial desde la zona, vuelve a la zona nueva si cambia; tocar el mapa y la ubicación lo mueven
- [x] 2.2 `MapaZona.tsx`: recentra cuando cambia el punto
- [x] 2.3 Test de componente: con zona llama a optimizar con su centro sin tocar nada; al cambiar la zona, con el nuevo centro

## 3. Paso 3 dice qué suma

- [x] 3.1 `utils/canastaPorCadena.ts`: titular según cuántas categorías compara, y la línea de las que no entran (frescas primero, hasta 4, "y N más"), con tests
- [x] 3.2 `CanastaPorCadena.tsx` usa esos textos
- [x] 3.3 Lint, `tsc -b`, `vitest` y `build`

## 4. Verificación y docs

- [x] 4.1 E2E en WebKit a 375 y 414 px, Lomas, con la canasta del INDEC
  - "+" y "−" dentro de su caja en todas las filas, y subir una cantidad
  - el mapa en Lomas, con sucursales a menos de 5 km
  - el titular del paso 3 con "25 categorías" y la línea de lo que no entra
  - sin desborde
- [x] 4.2 `docs/DECISIONES.md`: sección "Tu canasta confiable" con lo medido. README si cambian los conteos
- [x] 4.3 `openspec validate tu-canasta-confiable --strict`
