# Design

## Context

El informe `Desktop/investigaciones/reports/Convi competidor de Changuito.md` (27-11) relevó cómo se arman hoy las promos bancarias de supermercado en la Argentina. Lo que importa para este diseño:

- **La fuente más completa son las páginas de descuentos de cada cadena.**
  - Carrefour tiene vistas por día y por banco, con vigencia, %, tope y legales.
  - Jumbo, Disco y Vea usan parámetros por día.
  - Día pone el % dentro de imágenes.
  - Coto no se pudo leer sin JavaScript.
- **MODO publica un feed estructurado**, que sirve para controlar.
- **No hay un dataset abierto oficial**, y SEPA no las trae.
- **Más de la mitad de las promos son reintegros con tope**, y casi la mitad tienen alguna condición: segmento, compra mínima, rubros o canal.

El 27-11, el navegador integrado de esta sesión no tuvo permiso para abrir carrefour.com.ar ni modo.com.ar. La primera carga de datos necesita ese acceso, o que la haga una persona (ver Open Questions).

En el código:
- La portada (`Presentacion` y `PromosPage`) ya tiene la vidriera de promos de góndola.
- Mi compra (`ListaPage`, `TuLista`) cotiza la lista por cadena a precio de lista, la mediana nacional de cada cadena.
- La zona trae `zona.cadenas` con los nombres de SEPA.
- El frontend muestra los nombres con `nombreCadena`, y `conNombresDeCadena` renombra los campos `cadena` de cada respuesta.
- La imagen copia `api/` entera.

## Goals / Non-Goals

**Goals:**
- Mostrar promos bancarias confiables, con su fuente y su fecha de revisión, de las cadenas de la zona.
- Decir "con qué pagar" la lista: cuánto se paga en caja y cuánto se devuelve, sin mezclar las dos cifras.
- No gastar nada: ni BigQuery ni servicios de terceros.
- Validar la función con datos curados antes de invertir en lectores automáticos.

**Non-Goals:**
- Lectores automáticos de las páginas. Van en otro change, después de leer términos y robots y de consultarlo legalmente.
- El tope ya consumido según Mis gastos. Es el siguiente change: necesita preguntar con qué se pagó cada ticket.
- Promos online y de otros rubros (combustible, farmacia).
- Cuentas o sincronizar "Mis tarjetas" entre dispositivos.

## Decisions

### 1. Un JSON en el repo, no una tabla de BigQuery
`api/datos/promos_bancarias.json`:
- Se versiona con git, así cada cambio tiene autor y fecha.
- Se revisa en un PR o commit.
- La API lo lee una vez por instancia, sin cuota ni Storage Read.

Alternativa descartada: una seed de dbt en BigQuery. Suma una corrida del pipeline para cada corrección y no aporta nada a este volumen, de unas 100 a 200 promos.

### 2. El esquema y sus valores
Cada promo:

```json
{
  "id": "dia-modo-miercoles-2026-11",
  "cadenas": ["Dia"],
  "entidad": "MODO",
  "medio": "qr",
  "segmento": null,
  "dias": ["miercoles"],
  "porcentaje": 20,
  "tipo": "reintegro",
  "canal": "ambos",
  "tope": 20000,
  "tope_periodo": "mensual",
  "compra_minima": 35000,
  "rubros": null,
  "acumula": "no_se_sabe",
  "vigente_desde": "2026-11-01",
  "vigente_hasta": "2026-11-30",
  "fuente": "https://…",
  "revisada": "2026-11-27",
  "nota": "solo con la app MODO de cualquier banco adherido"
}
```

Valores admitidos:
- **`medio`**: `credito`, `debito`, `qr`, `billetera` o `prepaga`.
- **`tipo`**: `descuento` (en caja) o `reintegro`.
- **`canal`**: `sucursal`, `online` o `ambos`.
- **`tope_periodo`**: `compra`, `dia`, `semana`, `mes` o `null` (sin tope).
- **`acumula`**: `si`, `no` o `no_se_sabe`.
- **`cadenas`**: nombres de SEPA, como en `zona.cadenas`. Una promo de "Carrefour" lista una por una las banderas donde vale, porque la página lo dice.

El validador vive en `api/promos_bancarias.py`, con la lista de cadenas conocidas tomada de las que el sitio ya usa. Los tests de la API lo corren contra el archivo real.

### 3. Endpoint `GET /api/promos-bancarias`
- Devuelve las promos con `vigente_desde <= hoy <= vigente_hasta` en la fecha de la Argentina.
- Lleva un `revisadas_hasta` con la revisión más vieja de las que se sirven, para avisar si el archivo quedó viejo.
- No filtra por día ni por zona: son pocas promos y el frontend filtra. Así se puede guardar en caché y no recibe datos del usuario, ni la zona ni las tarjetas.
- `cadenas` llega con los nombres de SEPA, igual que `zona.cadenas`, para comparar sin traducir. Se escriben con `nombreCadena` recién al dibujarlas, como las listas `cadenas` de `/zonas`.

### 4. Filtrado y cálculo en el frontend, en un solo lugar
`utils/promosBancarias.ts`:
- `promosDelDia(promos, dia, cadenasZona, tarjetas)`.
- `pagoConPromo(total, promo, tarjetas)`, que devuelve `{ pagaEnCaja, teDevuelven, aConfirmar?: motivo, faltaParaMinimo? }`.
- La "mejor promo" por cadena es la de mayor ahorro calculable. Las que quedan "a confirmar" se listan aparte.

Reglas:
- Descuento: `pagaEnCaja = total − min(total × %, tope)`.
- Reintegro: `pagaEnCaja = total` y `teDevuelven = min(total × %, tope)`.
- El tope se toma entero, como si no se hubiera usado, y se dice: "si ya usaste parte del tope este mes, te devuelven menos".
- Rubros, o un segmento no marcado: queda a confirmar.
- Debajo de la compra mínima: dice cuánto falta.
- El total es a precio de lista, el mismo de Mi compra. Si `acumula` es `no_se_sabe`, se aclara que puede no sumarse a las promos de góndola.

### 5. "Mis tarjetas" en el teléfono
- `changuito.tarjetas.v1` guarda `{ entidades: string[], segmentos: string[] }`.
- La lista de entidades sale de las promos vigentes: no hay catálogo aparte que mantener.
- Se abre desde el bloque de la portada y desde "Con qué pagar".
- No se manda al servidor.

### 6. Dónde va en cada pantalla
- **Portada:** un bloque "Promos bancarias de hoy" después de la vidriera de promos del día, con chips Hoy y Mañana. Cada tarjeta lleva la cadena, un % grande, la entidad y una línea de condiciones ("Reintegro · sucursal · tope $ 20.000 por mes"), y abajo "Fuente · revisada el 27/11".
- **Mi compra:** "Con qué pagar hoy", plegado debajo de la cifra, junto a "Más formas de ahorrar". Muestra las cadenas completas de la zona, cada una con su mejor promo y las dos cifras.
- **Sin zona:** el bloque invita a elegirla. Sin promos ese día: muestra el próximo día con promos.

### 7. La curaduría
`docs/promos-bancarias.md` explica:
- las fuentes por cadena, con su URL;
- la frecuencia: a principio de mes, y un repaso cada lunes;
- qué anotar y qué no copiar;
- cómo cerrar una promo que desapareció (`vigente_hasta` = ese día);
- cómo usar MODO para encontrar lo que falta;
- correr los tests antes de commitear.

## Risks / Trade-offs

- **[Datos viejos o equivocados]** → Hay vigencia obligatoria, fecha de revisión visible, enlace a la fuente y "confirmá en la app de tu banco". Además `revisadas_hasta` permite avisar cuando la revisión tiene más de 10 días.
- **[Trabajo manual cada semana]** → Es lo que se quiere medir antes de automatizar. Si la función no mueve la carga de tickets, no vale la pena el lector.
- **[Legal]** → Se guardan solo hechos y palabras propias, con enlace a la fuente. No se usa ningún dato de Convi.
- **[Cálculos que prometen de más]** → Las dos cifras van separadas, el tope se aplica entero y se aclara, y lo dudoso queda "a confirmar".

## Migration Plan

Sin migración: es un archivo y un endpoint nuevos y bloques que no cambian lo existente. Con el archivo vacío, los bloques no se muestran. Volver atrás es revertir el commit.

## Open Questions

- **¿Quién hace la primera carga y la revisión semanal?** Puede ser Rodrigo, una sesión de Claude con permiso para abrir las páginas de las cadenas (el navegador integrado las rechazó el 27-11; se pueden habilitar o usar Claude en Chrome), o los dos.
- **¿Qué cadenas entran primero?** La propuesta es Carrefour, Coto, Día, Jumbo/Disco/Vea y ChangoMás para AMBA, y después La Anónima y Cooperativa Obrera.
