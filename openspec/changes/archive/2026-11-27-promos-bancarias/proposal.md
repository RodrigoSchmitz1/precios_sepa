# Proposal

## Why

En la Argentina, el mayor ahorro en el súper no está en la góndola: son los reintegros y descuentos de bancos y billeteras por día, del orden de 20-35 % con tope. SEPA no los trae. Convi, la competencia mejor hecha, ya los muestra y piensa cobrar el cruce con tus tarjetas.

Changuito puede darlo gratis, como parte de lo que gana quien usa la app. Más adelante también puede cruzarlo con Mis gastos para saber cuánto tope te queda. Este change arranca con datos curados a mano, para validar la función antes de automatizar la lectura de las fuentes.

## What Changes

- **Archivo de promos bancarias curadas** en el repo, validado por tests. La fuente son las páginas de descuentos de cada súper: Carrefour, Coto, Día, Jumbo, Disco y Vea, ChangoMás, La Anónima y Cooperativa Obrera. MODO sirve como control. Nunca se usan los datos de Convi.
  - Cada promo guarda solo hechos, con palabras propias: cadenas, entidad, medio, segmento, días, %, descuento o reintegro, canal, tope y su período, compra mínima, rubros, si acumula, vigencia, fuente y fecha de revisión.
- **Endpoint `GET /api/promos-bancarias`** que sirve el archivo desde memoria, sin BigQuery. Lo vencido no se sirve.
- **Portada:** "Promos bancarias de hoy" de las cadenas de tu zona, con chips Hoy y Mañana. Cada promo muestra su fuente y "revisada el …".
- **"Mis tarjetas":** el usuario marca sus bancos y billeteras. Se guarda solo en el teléfono y filtra lo que se muestra.
- **Mi compra, "Con qué pagar":**
  - para cada cadena de la zona, cuánto pagás en caja y cuánto te devuelven (en 10 a 30 días), con el tope aplicado;
  - lo que depende de un segmento o de ciertos rubros va como "a confirmar", sin monto;
  - el canal por defecto es la sucursal;
  - si no se sabe si acumula con la promo de góndola, se dice.
- **Un documento de curaduría semanal**: qué fuentes se miran, qué se anota, qué no se copia y cómo se marca lo revisado.

## Capabilities

### New Capabilities
- `promos-bancarias`: los datos curados de promos de bancos y billeteras en supermercados, su publicación por la API, cómo se muestran en la portada, "Mis tarjetas" y el cálculo de "Con qué pagar" en Mi compra.

### Modified Capabilities
_(ninguna: las pantallas existentes suman un bloque nuevo sin cambiar sus requisitos actuales)_

## Impact

- **API:**
  - un archivo de datos nuevo (`api/datos/promos_bancarias.json`) y su validador;
  - un endpoint en `api/main.py`;
  - tests nuevos.
  - La imagen de Docker ya copia `api/` entera.
- **Frontend:**
  - en `api/client.ts`, el pedido nuevo;
  - utilidades para filtrar por día, por zona y por tarjetas, y para calcular el pago;
  - un bloque en la portada (`Presentacion`/`PromosPage`), "Mis tarjetas" y un bloque en `ListaPage`.
- **Costo:** cero. El archivo se lee una vez por instancia y no hay consultas a BigQuery ni a terceros.
- **Operación:** alguien tiene que actualizar el archivo cada semana. Lo que pasó la fecha de vigencia deja de mostrarse solo.
- **Fuera de alcance:**
  - lectores automáticos de las páginas, para otro change después de revisar términos y robots;
  - el tope ya consumido según Mis gastos;
  - sorteos y cuentas.
