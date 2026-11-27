## MODIFIED Requirements

### Requirement: El resultado entra en la primera pantalla
Cuando hay una búsqueda de 2 letras o más o un producto elegido, Mismo producto SHALL mostrar su titular en versión compacta, sin bajada. En un celular de 414x896, el primer resultado SHALL empezar antes de los 320 px.

#### Scenario: Buscar desde el celular
- **WHEN** el usuario busca "yerba playadito" en un celular
- **THEN** el primer resultado se ve sin bajar la pantalla

#### Scenario: Primera visita sin nada
- **GIVEN** no hay búsqueda ni producto elegido
- **WHEN** el usuario entra a Mismo producto
- **THEN** ve el titular completo, con la cifra del día y la bajada

### Requirement: Tu lista compara las cadenas de tu zona
Con una zona elegida, Tu lista SHALL armar su cifra principal, el ahorro y la lista de cadenas con todos los productos usando solo las cadenas que tienen al menos una sucursal en la zona. El ahorro SHALL medirse entre la más barata y la siguiente de esas cadenas, no la más cara. Las cadenas sin sucursal en la zona SHALL ir en una sección aparte, sin entrar en el ahorro.

#### Scenario: Palermo
- **GIVEN** la zona es Palermo y la lista sale $ 54.619 en Día, $ 56.767 en Market y $ 58.030 en Express, todas con sucursal cerca
- **WHEN** el usuario ve Tu lista
- **THEN** la cifra principal dice Día, $ 54.619, y $ 2.148 menos que en Market

#### Scenario: Lomas de Zamora
- **GIVEN** la zona es "Lomas de Zamora, Buenos Aires", donde hay Carrefour, Coto, Dia, Disco, Express (Carrefour) y Maxi (Carrefour)
- **AND** la Cooperativa Obrera es la más cara del país para la lista
- **WHEN** el usuario ve Tu lista
- **THEN** la cifra principal compara la más barata de la zona con la siguiente de la zona, y la Cooperativa Obrera aparece solo en "Otras cadenas del país"

#### Scenario: Sin zona elegida
- **WHEN** no hay zona elegida
- **THEN** Tu lista compara todas las cadenas del país con la misma regla de la siguiente opción

## ADDED Requirements

### Requirement: Buscar no repite la lista
La página de búsqueda NO SHALL mostrar la lista entera debajo de los resultados. Cada resultado que ya está en la lista SHALL decir "✓ En la lista". Con productos en la lista, SHALL haber un acceso "Ver mi compra (N)" que lleva a `/lista`.

#### Scenario: Buscar con una lista de 12
- **GIVEN** la lista tiene 12 productos
- **WHEN** el usuario busca "yerba playadito"
- **THEN** ve los resultados y el acceso "Ver mi compra (12)", sin los 12 productos debajo

### Requirement: El titular de una búsqueda sale de sus resultados
Con una búsqueda, el titular compacto SHALL decir la mayor diferencia entre cadenas de los resultados que se muestran. Sin búsqueda, SHALL mostrar la mayor diferencia del día, como hasta ahora. Si ningún resultado tiene diferencia para mostrar, SHALL decir "El mismo producto, otro precio".

#### Scenario: Buscar yerba Playadito
- **GIVEN** los resultados de "yerba playadito" tienen diferencias de 28 %, 37 %, 94 %, 83 %, 31 % y 58 %
- **WHEN** el usuario busca "yerba playadito"
- **THEN** el titular dice que el mismo producto puede costar 94 % más según la cadena, no la cifra de otro producto del día
