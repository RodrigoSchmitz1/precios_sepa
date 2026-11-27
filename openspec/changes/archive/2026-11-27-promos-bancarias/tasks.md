# Tasks

## 1. Datos y API

- [x] 1.1 Escribir `api/promos_bancarias.py`:
  - validar cada promo según el esquema del diseño;
  - tener la lista de cadenas conocidas;
  - filtrar las vigentes en la fecha de la Argentina.

  Verificar con `api/test_promos_bancarias.py`: campo faltante, % fuera de rango, vigencia invertida, cadena desconocida, revisión futura y promo vencida que no se sirve.
- [x] 1.2 Crear `api/datos/promos_bancarias.json` con una primera carga de prueba (2 o 3 promos reales revisadas en la página de la cadena, con su URL y su fecha). Hacer que un test valide el archivo real.
- [x] 1.3 Sumar `GET /api/promos-bancarias` en `api/main.py`: lee el archivo una vez por instancia, devuelve las vigentes y `revisadas_hasta`, y no toca BigQuery. Verificar con un test con TestClient.

## 2. Frontend: datos y reglas

- [x] 2.1 Sumar en `api/client.ts` el pedido y el tipo `PromoBancaria`. Las `cadenas` quedan con los nombres de SEPA, como `zona.cadenas`, y se muestran con `nombreCadena`.
- [x] 2.2 Escribir `utils/promosBancarias.ts`:
  - `promosDelDia`, que filtra por día, por cadenas de la zona y por tarjetas;
  - `pagoConPromo`, con descuento, reintegro, tope, compra mínima, rubros y segmento;
  - la mejor promo por cadena.

  Verificar con tests sobre los escenarios de la spec: el reintegro con tope de $ 10.000 sobre $ 54.619, el 25 % en caja sobre $ 57.212, solo algunos rubros y debajo del mínimo.
- [x] 2.3 Escribir `utils/tarjetas.ts` ("Mis tarjetas" en `changuito.tarjetas.v1`, con try/catch). Verificar con tests: guardar, leer y almacenamiento bloqueado.

## 3. Pantallas

- [x] 3.1 Hacer el bloque "Promos bancarias de hoy" de la portada:
  - chips Hoy y Mañana;
  - una tarjeta por promo, con su fuente y "revisada el";
  - invitación a elegir zona;
  - si ese día no hay promos, el próximo día que tenga;
  - va después de las promos del día.

  Verificar con tests y a 375 px, con "Las promos del día" todavía en la primera pantalla.
- [x] 3.2 Hacer el selector "Mis tarjetas" (entidades de las promos vigentes y segmentos opcionales) y el filtro con "Ver todas". Verificar con tests: marcar dos entidades filtra, y sin marcar se muestran todas con la invitación.
- [x] 3.3 Hacer el bloque plegado "Con qué pagar hoy" en Mi compra:
  - cada cadena completa de la zona con su mejor promo;
  - "pagás en caja" y "te devuelven en 10 a 30 días";
  - las aclaraciones de tope y acumulación;
  - lo que queda a confirmar.

  Verificar con tests y a 375 px.

## 4. Curaduría y cierre

- [x] 4.1 Escribir `docs/promos-bancarias.md` con fuentes por cadena, frecuencia, campos, qué no copiar, cómo cerrar una promo y el control con MODO.
- [x] 4.2 Correr tests, lint y build del frontend y los tests de la API. Recorrer en WebKit a 414 px la portada, Mis tarjetas y Mi compra, sin desbordes ni errores.
- [x] 4.3 Anotar en `docs/DECISIONES.md`: la fuente elegida y por qué no se usa Convi, por qué un JSON y no BigQuery, las dos cifras separadas y el tope entero, y qué queda para el lector automático y para el tope según Mis gastos.
