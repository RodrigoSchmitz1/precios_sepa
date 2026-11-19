# Proposal

## Why

En una familia, la compra se arma entre varios: uno anota y otro va al súper.
Hoy Tu lista vive solo en el navegador de quien la armó. No se puede mandar por
WhatsApp, y una lista que llega escrita en un chat ("2 leches, yerba, pan") hay
que cargarla buscando producto por producto. Lo marcó el segundo explore
externo como oportunidad 3: la lista no circula, y la familia es la unidad de
compra. Además, es la forma natural de que Changuito se difunda antes de salir
a promocionarlo.

## What Changes

- **Compartir Tu lista.** Un botón arma un texto legible para WhatsApp y abre el
  menú nativo del celular (en la computadora, lo copia). El texto lleva:
  - los productos con sus cantidades;
  - dónde sale menos, y en qué zona;
  - un link que rearma la lista.
- **Abrir una lista compartida.** El link (`/lista?l=…`) muestra la lista
  recibida, cotizada en la zona de quien la abre, sin tocar la propia.
  - Si quien la abre no tenía lista, se guarda directo.
  - Si tenía, elige entre "Sumar a mi lista" y "Reemplazar mi lista". Lo
    decidió Rodrigo.
- **Pegar una lista escrita.** En Tu lista, "Pegar una lista" recibe el texto de
  un chat. Cada renglón pasa por el buscador del sitio: se separa la cantidad
  ("2 leches" da 2 de leche), se sacan viñetas y palabras de relleno, y se
  prefieren los básicos ("yerba" da la yerba de los básicos). La persona ve el
  producto elegido para cada renglón, puede cambiarlo por otra opción o
  sacarlo, y suma todo de un toque. Va sin IA, por decisión de Rodrigo: es
  gratis, instantáneo y no hay nada que abusar.
- **La tarjeta del link** de una lista compartida dice cuántos productos tiene.

## Capabilities

### New Capabilities

Ninguna.

### Modified Capabilities

- `compartir`: Tu lista se puede compartir como texto y link, y su link llega
  con tarjeta.
- `tu-lista`: abrir una lista compartida y pegar una lista escrita.

## Impact

- **API:**
  - `POST /api/mismo-producto/interpretar`: renglones de texto a productos
    candidatos, en memoria y sin BigQuery;
  - `api/compartir.py`: la tarjeta de `/lista?l=`;
  - tests.
- **Frontend:**
  - `utils/compartir.ts`: el texto de la lista, y copiar texto y link donde no
    hay menú nativo;
  - `utils/lista.ts`: codificar y leer la lista del link, sumar y reemplazar;
  - `TuLista.tsx` y `ListaPage.tsx`: el botón, la lista recibida y el pegado;
  - tests.
- **Costo:** cero. El pegado es un pedido a la API, que busca en el índice en
  memoria. El link no guarda nada en el servidor.
