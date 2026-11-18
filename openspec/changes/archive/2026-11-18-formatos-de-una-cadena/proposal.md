# Proposal

## Why

El explore externo del 17-11 (candidato 10) marcó un problema de ruido en Mismo producto:
- **Formatos de una misma cadena como filas separadas:** Changomás, SuperChangomás e HiperChangomás van en tres filas, y Carrefour, Market y Express en otras tres.
- **Titulares que no se entienden:** "3% más caro en Coto que en Changomás y 1 más".
- **La propuesta del explore:** agruparlos en "Changomás (3 formatos)" y "Carrefour (Market, Express, Hiper)", con Maxi aparte.

Medido el 18-11 sobre los 47.740 productos de Mismo producto, las banderas de una empresa no cobran lo mismo:

| Par | Productos | Mismo precio | Diferencia |
|---|---|---|---|
| Carrefour y Market | 18.425 | 89% | p90 de 0,8% |
| Carrefour y Express | 5.599 | 44% | p90 de 8% |
| Changomás y SuperChangomás | 27.696 | 36% | SuperChangomás 4% más barata de mediana |
| Changomás e HiperChangomás | 27.725 | 38% | p90 de 2% |
| Vea, Disco y Jumbo | | | Vea 4% más cara; para la gente son súper distintos |

Juntar cada empresa en una sola fila escondería diferencias reales. SuperChangomás es justamente una de las dos cadenas que explican el ahorro por comparar (DECISIONES, "Dispersión y reglas de precio"). Lo que sí es ruido es la fila repetida cuando dos formatos cobran exactamente lo mismo ese producto:
- Agruparlos baja las filas por producto de 4,3 a 3,5 de promedio, y de 14 a 12,4 en los 400 productos más comunes. Pasa en el 51% de los productos.
- En 10.501 productos, el precio más bajo lo comparten formatos de una misma empresa, y ahí nace el "Changomás y 1 más".

## What Changes

- **Formatos con el mismo precio, en una fila.** En el detalle de un producto, los formatos de una misma cadena que tienen exactamente el mismo precio van en una sola fila: "Changomás · HiperChangomás", con las sucursales sumadas. Si cobran distinto, siguen en filas separadas.
  - Son formatos de una cadena Carrefour, Market y Express (de Carrefour) y Changomás, SuperChangomás e HiperChangomás.
  - Maxi no, porque tiene otra lógica de precio (−5% de mediana contra Carrefour).
  - Vea, Disco y Jumbo tampoco, porque son súper distintos.
- **Los nombres se dicen completos.** Donde hoy dice "Changomás y 1 más" o "Coto y 2 más", dice los nombres: "Changomás e HiperChangomás", "Coto, Día y Vea". Con más de tres, nombra tres y "y N más". Los formatos de una cadena con el mismo precio se nombran juntos.
- **Sin cambios en los números.** Ningún precio, total, extremo ni porcentaje cambia. Es presentación.

Fuera de alcance:
- **Tu lista, Más barato y Tu canasta:** sus rankings comparan totales por bandera, que sí difieren. Siguen por bandera.
- **Las cadenas de la zona:** siguen por bandera. Una zona puede tener un Express y no un Carrefour.

## Capabilities

### New Capabilities
<!-- Ninguna. -->

### Modified Capabilities
- `mismo-producto`: suma dos requisitos: los formatos de una cadena con el mismo precio van en una fila, y las cadenas se nombran completas en los titulares y extremos.

## Impact

- **Frontend:**
  - `utils/formatosDeCadena.ts`, nuevo: qué banderas son formatos de una cadena, cómo agruparlas por precio y cómo nombrar una lista de cadenas.
  - `MismoProductoPage.tsx`: las filas de precios y los nombres.
  - Tests.
- **API y BigQuery:** nada.
- **Docs:** sección en `docs/DECISIONES.md` con lo medido, incluido por qué no se juntan las cadenas enteras.
