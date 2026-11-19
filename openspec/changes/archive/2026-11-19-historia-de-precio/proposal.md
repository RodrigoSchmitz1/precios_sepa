# Proposal

## Why

Changuito sabe cuánto cuesta un producto hoy, pero no cuánto costaba antes: `int_precio_producto_cadena` vence a los 3 días y el crudo a los 4. Por eso no puede decir "tu yerba bajó" ni ayudar con la sospecha argentina por excelencia, "¿esta promo es real o subieron el precio antes?". El explore externo del 17-11 lo marcó como la apuesta grande (candidato 6), con la condición de medir antes el almacenamiento. La historia solo se puede juntar desde el día en que se empieza a guardar, así que cada semana de demora es una semana de historia que se pierde para siempre.

Medido el 18-11:
- **Almacenamiento:** 7,1 de los 10 GiB gratuitos están usados.
- **Una foto diaria entera:** el precio de cada producto por cadena (229 mil filas, unos 8,5 MiB por día) llenaría lo que queda en menos de un año.
- **Lo que cambia por día:** solo unos 2.950 precios (1,3%) y unos 1.000 productos nuevos.
- **Registro de cambios:** guardando solo los cambios, el primer día ocupa unos 10 MiB y después unos 0,2 MiB por día. Eso son unos 75 MiB por año.

## What Changes

- **Historia como registro de cambios.** Nace un histórico, `historico_precio_producto`, que guarda una fila por producto y cadena solo cuando cambia su precio creíble, el mismo que muestra el sitio (`mart_mismo_producto`). No vence nunca y no se reconstruye con `--full-refresh`, igual que los otros históricos.
- **El último cambio que importa.** Nace un mart chico, `mart_cambio_precio`, con el último cambio de cada producto y cadena, solo si pasó en los últimos 30 días y movió el precio un 3% o más.
  - Medido: entre el 16 y el 17-11, la mitad de los cambios vino con otra cantidad de sucursales informando. Esos cambios son casi todos menores al 3%: es la mediana que se mueve, no la cadena que remarca.
  - Los cambios con las mismas sucursales son casi todos del 3 al 10%.
  - Ambos umbrales viven en variables de dbt.
- **La API.** Suma ese cambio a cada precio del índice de Mismo producto. Lo lee con la Storage Read API al cargar, sin consultas nuevas.
- **El detalle del producto.** Cada cadena con un cambio reciente dice "Subió 8% el 25/11" o "Bajó 6% el 25/11", con el precio anterior.
- **Tu lista.** Debajo de cada producto, si el precio de la cadena más barata de tu zona cambió hace poco, dice "Bajó 6% en Día el 25/11".
- **Sin historia, no se dice nada.** El primer día no hay cambios para mostrar. Un producto sin cambios no muestra nada, nunca "sin cambios": no se puede afirmar que no cambió antes de que se empezara a guardar.

Fuera de alcance, para un change aparte cuando haya al menos 30 días guardados:
- "¿esta promo es real?", que compara el precio de lista de la promo con el de semanas antes
- gráficos de evolución

## Capabilities

### New Capabilities
- `historia-de-precio`: cómo se guarda la historia del precio de cada producto por cadena, qué cuenta como un cambio y cómo se lo cuenta en el detalle y en Tu lista.

### Modified Capabilities
<!-- Ninguna: el detalle y Tu lista suman una línea, pero sus requisitos actuales no cambian. -->

## Impact

- **dbt:**
  - nuevos `models/historicos/historico_precio_producto.sql` y `models/marts/mart_cambio_precio.sql`, con sus tests
  - variables `cambio_precio_minimo_pct` y `cambio_precio_dias` en `dbt_project.yml`
- **BigQuery:**
  - almacenamiento: unos 10 MiB más unos 0,2 MiB por día
  - consultas: leer la historia y el mart del día suma unos 30 a 50 MiB por corrida, contra el tope de 32 GiB
- **API:**
  - `api/main.py`: carga el mart nuevo con `leer_tabla`
  - `api/mismo_producto.py`: el índice, el detalle y `cotizar_lista` llevan el cambio
- **Frontend:**
  - tipos
  - `MismoProductoPage.tsx`
  - `TuLista.tsx`
  - un util de texto compartido, con sus tests
- **Docs:** sección en `docs/DECISIONES.md` con lo medido.
