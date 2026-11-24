# Spec Delta

## ADDED Requirements

### Requirement: Lista de ejemplo en la primera visita
La app SHALL cargar una lista de ejemplo al abrirse, en cualquier página, cuando la lista está vacía y el ejemplo nunca se cargó en ese navegador; una lista recibida por link SHALL tener prioridad y en ese caso no se carga el ejemplo. En Mi compra, el ejemplo SHALL mostrarse marcado como "Lista de ejemplo", con la comparación de dónde comprarla en la zona visible sin ningún toque más.

#### Scenario: Primera visita
- **WHEN** alguien abre Mi compra por primera vez con una zona elegida
- **THEN** ve la lista de ejemplo marcada como tal y cuánto sale en cada cadena de su zona

#### Scenario: No vuelve si se borró
- **WHEN** el usuario borró el ejemplo y vuelve a entrar con la lista vacía
- **THEN** ve el armado rápido, sin lista de ejemplo

### Requirement: Qué tiene el ejemplo
El ejemplo SHALL tener unos 12 básicos de al menos cinco grupos, tomados de los básicos que sirve la API. Si la API falla o devuelve menos de 8 de los elegidos, no SHALL cargarse ejemplo y Mi compra SHALL mostrar el armado rápido como hasta ahora.

#### Scenario: Sin básicos
- **WHEN** el pedido de básicos falla al abrir la app
- **THEN** la lista queda vacía y Mi compra muestra el armado rápido

### Requirement: Borrar el ejemplo entero o por grupo
Mientras la lista sea de ejemplo, Mi compra SHALL ofrecer un botón "Borrar el ejemplo", que vacía la lista y recuerda que no hay que volver a cargarla, y un chip por cada grupo presente, que saca de la lista todos los productos de ese grupo.

#### Scenario: Sacar un grupo
- **WHEN** el usuario toca el chip "Limpieza"
- **THEN** salen de la lista todos los productos de Limpieza y la comparación se recalcula con el resto

### Requirement: El ejemplo pasa a ser tuyo al tocarlo
Al sumar un producto, quitar uno suelto o cambiar una cantidad, la lista SHALL dejar de ser de ejemplo: se quita la marca y el cartel, y queda como lista propia. Sacar un grupo con su chip no la convierte.

#### Scenario: Sumar un producto
- **WHEN** con la lista de ejemplo el usuario suma un producto desde el buscador
- **THEN** la lista deja de decir "Lista de ejemplo" y conserva los productos que tenía
