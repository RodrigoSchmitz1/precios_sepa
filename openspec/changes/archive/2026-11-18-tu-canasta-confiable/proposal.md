# Proposal

## Why

Tu canasta es la sección cuyo diferencial es que los números sean confiables. Hoy tiene tres fallas que dicen "no está terminado". Las reproduje el 18-11 en producción, en WebKit a 414 px, con la canasta del INDEC para 2 adultos y 2 chicos en Lomas de Zamora.

1. **El "+" de las cantidades no se ve en el celular.**
   - La caja del control mide 77 px y su contenido 106 px. El "+" queda en x=117, fuera del `overflow-hidden`, que termina en x=112.
   - En la fila de Pan, donde el número es más largo, desaparece el "−".
   - La causa: la regla que fuerza 16 px en los campos para que iOS no haga zoom agranda el número, y el control se encoge dentro de la fila.
   - Además el campo es `type=number` y muestra "20.86", con punto decimal, contra la regla es-AR del sitio.
2. **El mapa del paso 4 abre en el Obelisco** aunque la zona sea Lomas (`MapaZona.tsx`: centro fijo). Si se toca el centro del mapa, recomienda sucursales de San Nicolás y San Telmo, a 15 km. Es un resto de antes de la zona compartida.
3. **Dos totales que parecen la misma cosa y no coinciden.**
   - El paso 3 titula "En Maxi te sale unos **$ 514.122**". El paso 4, con el punto en el Obelisco, dice "En una sucursal **$ 738.063**".
   - Aun con el punto en Lomas, el paso 4 dice "Carrefour **$ 676.951**" (31 categorías), y el paso 3 tiene a Carrefour en **$ 556.269**.
   - La diferencia es que el paso 3 suma solo las 25 de 32 categorías que venden todas las cadenas, para comparar parejo. Quedan afuera azúcar, papa, verduras, frutas, pollo, pescado y huevos, justo lo que más compra una familia o un jubilado. Eso se explica en letra chica.

Fue el candidato 8 del explore externo del 17-11.

## What Changes

- **El control de cantidades entra en el celular.**
  - El "−", el número y el "+" se ven y se pueden tocar a 375 y 414 px.
  - El número se escribe en es-AR ("20,86") y se puede tipear con coma o con punto.
  - Sigue en 16 px, para que iOS no haga zoom.
- **El paso 4 arranca en tu zona.** Con una zona elegida, el mapa abre centrado en ella y calcula enseguida las sucursales cercanas, sin tener que tocar el mapa. Si se cambia la zona, el punto se mueve a la nueva. Tocar el mapa o "Usar mi ubicación" siguen moviendo el punto. Sin zona, como hoy.
- **El paso 3 dice qué suma, en grande.** Su titular es la comparación entre cadenas y dice sobre cuántas categorías:
  - "En las 25 categorías que venden todas, Maxi te sale unos $ 514.122 y Express $ 572.959: ahorrás $ 58.837 (10%)".
  - Debajo, una línea visible, no letra chica: "Verdura, fruta, pollo y huevos no entran acá porque no los venden todas las cadenas; el paso 4 sí los suma, sucursal por sucursal".
  - Así el total de la canasta entera es uno solo, el del paso 4.

Alternativa descartada: completar el total del paso 3 con las 7 categorías que faltan al precio de la zona, igual en todas las cadenas. Haría parecidos los números, pero diría "en Maxi te sale $ X" incluyendo verdura que Maxi no informa. Sugiere una precisión que el dato no tiene.

Fuera de alcance:
- El contexto de las cantidades del INDEC ("Pan 20,86 kg/mes, unos 690 g por día").
- La IA de Tu canasta.

## Capabilities

### New Capabilities
<!-- Ninguna. -->

### Modified Capabilities
- `tu-canasta`: suma tres requisitos: el control de cantidades usable en el celular y en es-AR, el paso 4 que arranca en la zona, y el paso 3 que dice sobre cuántas categorías compara. Los requisitos actuales no cambian.

## Impact

- **Frontend:**
  - `ItemCanastaEditable.tsx`: el control y el formato del número
  - `DondeComprarla.tsx`: el punto inicial desde la zona
  - `MapaZona.tsx`: recentrar cuando cambia el punto
  - `CanastaPorCadena.tsx`: el titular y la línea de lo que no entra
  - un util chico para leer y escribir cantidades en es-AR
  - tests de todo lo anterior
- **API:** nada. `/canasta-personalizada/optimizar` y `/por-cadena` ya devuelven lo necesario (`categorias_comparadas`, `categorias_afuera`) y responden desde memoria.
- **BigQuery:** nada.
- **Docs:** sección en `docs/DECISIONES.md` con lo medido.
