# Tasks

## 1. API

- [x] 1.1 `interpretar_renglon` e `interpretar` en `mismo_producto.py`: viñetas, cantidad, palabras de relleno, básico primero, hasta 3 candidatos, comas en una sola línea, topes de 2.000 caracteres y 50 renglones
- [x] 1.2 `POST /api/mismo-producto/interpretar` en `main.py`, declarado antes de `/{id_producto}`
- [x] 1.3 Tests con los casos medidos: "2 leches", "1 docena de huevos", "yerba" con el básico, "- 3 x atun", un renglón sin resultado, texto con comas y los topes
- [x] 1.4 Tarjeta de `/lista?l=` en `compartir.py` ("Lista del súper · N productos"), con test

## 2. Frontend

- [x] 2.1 `utils/lista.ts`: `listaALink`, `listaDelLink` y `sumarListas`, con tests de topes, códigos inválidos y repetidos
- [x] 2.2 `utils/compartir.ts`: `textoDeLista` y el modo que copia texto y link, con tests
- [x] 2.3 Botón "Compartir lista" en Tu lista
- [x] 2.4 La lista recibida en `ListaPage`: recuadro, cotización en la zona propia, guardar directo o sumar/reemplazar, `replaceState`, con test de componente
- [x] 2.5 "Pegar una lista": textarea, renglones con opciones, cantidad y quitar, "Sumar a mi lista", con test de componente

## 3. Verificación y documentación

- [x] 3.1 E2E en WebKit a 375 y 414 px: compartir (texto copiado), abrir el link sin lista y con lista (sumar y reemplazar), pegar una lista de WhatsApp
- [x] 3.2 Medir el pegado con los 30 renglones de la medición: cuántos dan el producto razonable primero
- [x] 3.3 Tests (API, frontend, lint, tsc, build), DECISIONES.md y README con los conteos
