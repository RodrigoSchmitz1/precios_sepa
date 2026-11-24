# Proposal

## Why

Rodrigo entró a Mis gastos y no vio nada: con cero tickets la página es un formulario vacío. Lo mismo pasa con Mi compra: el ahorro por súper recién aparece después de armar una lista. Quien entra por primera vez no ve en qué le sirve la app hasta haber cargado datos, y la mayoría se va antes. Hace falta que la primera visita muestre el valor con números de verdad (precios SEPA de su zona) y que sacarlos sea fácil.

## What Changes

- **Mi compra arranca con una lista de ejemplo**: la primera vez que se abre la app (en cualquier página), con la lista vacía, se cargan una sola vez 12 básicos: los dos de cada grupo (Almacén, Desayuno, Lácteos, Bebidas, Limpieza, Higiene) que venden más empresas, tomados de los básicos que ya sirve la API. Se marca como "Lista de ejemplo" y debajo se ve enseguida Dónde comprarla: cuánto sale en cada cadena de tu zona y cuánto ahorrás en la más barata o haciendo dos paradas. Hay un botón "Borrar el ejemplo" y chips por grupo para sacar una categoría entera. Al sumar, quitar o cambiar la cantidad de un producto, la lista deja de ser ejemplo y pasa a ser tuya. Si se borró, no vuelve.
- **Mis gastos muestra un mes de ejemplo**: con cero gastos, la página muestra 7 tickets de ejemplo del mes (varias cadenas y categorías, con líneas de promo) y todo lo que se ve con tickets reales: total del mes, por súper, por categoría, ahorro en promos y "en el más barato de tu zona hubieras pagado". Un cartel dice "Así se ve con tus tickets. Es un ejemplo." con el botón "Borrar el ejemplo y empezar". El ejemplo vive solo en memoria: no se guarda como gasto, no entra en el presupuesto, el Excel, la compra habitual ni las señales, y desaparece al cargar el primer gasto real.
- **Circuito de la primera visita**: como el ejemplo se carga al abrir la app, la tarjeta de tu lista de la portada ya muestra "Mirá cuánto ahorrás en tu compra" con el total en la cadena más barata, aclarando que es un ejemplo, y lleva a Mi compra; al pie de la comparación de Mi compra un paso siguiente lleva a Mis gastos.

Fuera de alcance: promos bancarias (SEPA no las trae; quedan para después), el guía Changuito (otro change), lectura de fotos con Gemini pago.

## Capabilities

### New Capabilities

### Modified Capabilities
- `tu-lista`: Mi compra arranca con una lista de ejemplo que se borra entera o por grupo.
- `mis-gastos`: con cero gastos se ve un mes de ejemplo que no se guarda.
- `portada`: tarjeta que lleva a Mi compra en la primera visita.

## Impact

Frontend: `ListaPage.tsx`, `ProveedorLista.tsx` y `utils/lista.ts` (marca de ejemplo), un componente nuevo para el cartel del ejemplo con los chips por grupo, `GastosPage.tsx` y un generador `utils/gastosDeEjemplo.ts`, la portada. API: ninguno; se usan `/basicos` y `donde-comprar-lista`, que ya responden desde memoria sin consultar BigQuery.
