# Tasks

## 1. Cifras de la portada

- [x] 1.1 `utils/cifrasPortada.ts` con `cifrasDePortada(...)`: sin zona, zona con 2 o más cadenas, zona sin canasta cotizable y zona con 1 cadena. Lo nacional se marca en el detalle. Con tests.
- [x] 1.2 `Presentacion.tsx`: separar la carga en datos fijos y datos que dependen de la zona. Con zona, usar `obtenerQuienGanaZona` y la canasta con la localidad de la zona (`localidadDeZona`), o caer al país si no hay localidad.
- [x] 1.3 Dibujar las tarjetas desde `cifrasDePortada` y quitar la línea "Estas cifras son de todo el país" cuando hay zona.
- [x] 1.4 Correr los tests del frontend, el lint y el build.

## 2. Verificación

- [x] 2.1 En WebKit a 414x896, contra la API local:
  - con Lomas de Zamora, la tarjeta 1 nombra la misma cadena que encabeza Más barato en la zona, y la tarjeta de ahorro nombra solo cadenas de Lomas;
  - con Rafaela, aparece "única cadena" y no hay ningún "ahorrás";
  - al cambiar la zona desde el encabezado, las tarjetas se actualizan.
- [x] 2.2 Una zona sin canasta cotizable muestra el ahorro del país y lo dice.
- [x] 2.3 Barrido de las 6 páginas sin desbordes ni errores, sin zona y con zona.
- [x] 2.4 Anotar en `docs/DECISIONES.md` la portada de la zona.
