# Tasks

## 1. Utilidades

- [x] 1.1 Escribir `utils/compraHabitual.ts` (productos en al menos 2 tickets con foto de los últimos 90 días, hasta 30, cantidad típica) y sacar la regla de "mezclar dos" de `mesDeGastos.ts` a una función compartida; verificar con `compraHabitual.test.ts` y con los tests de `mesDeGastos` sin cambios.
- [x] 1.2 Escribir `utils/presupuesto.ts` (guardar, sacar, avance con `AVISO_PRESUPUESTO`, almacenamiento bloqueado) y la racha de semanas en `resumenGastos.ts`; verificar con tests (85 % avisa, pasado dice por cuánto, racha que termina en la semana anterior, racha de 1 no se muestra).

## 2. Pantallas

- [x] 2.1 Crear `ParaTuProximaCompra` en `components/gastos/` (promos de la compra habitual y próxima compra en una sola sección) con los estados de zona, sin compra habitual y sin promos; verificar sumando casos a `GastosPage.test.tsx`.
- [x] 2.2 Sumar el presupuesto (poner, cambiar, sacar, barra y avisos) y el informe del mes con "Compartir" y la racha al resumen del mes; verificar con tests y a 375 px en el navegador.
- [x] 2.3 Actualizar el aviso de la foto (Google Gemini, Estados Unidos, "Acepto y saco la foto"); verificar con el test del aviso.

## 3. Cierre

- [x] 3.1 Correr tests, lint y build del frontend y recorrer Mis gastos en WebKit a 414 px sin desbordes.
- [x] 3.2 Anotar en `docs/DECISIONES.md` la compra habitual, el presupuesto y por qué el incentivo es informativo.
