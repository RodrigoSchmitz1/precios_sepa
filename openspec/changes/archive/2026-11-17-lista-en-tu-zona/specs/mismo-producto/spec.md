# Spec Delta

## ADDED Requirements

### Requirement: Tu lista compara las cadenas de tu zona
Con una zona elegida, Tu lista SHALL armar su titular, el ahorro y la lista de
cadenas con todos los productos usando solo las cadenas que tienen al menos una
sucursal en la zona. Las cadenas sin sucursal en la zona SHALL ir en una sección
aparte, sin entrar en el ahorro.

#### Scenario: Lomas de Zamora
- **GIVEN** la zona es "Lomas de Zamora, Buenos Aires", donde hay Carrefour, Coto, Dia, Disco, Express (Carrefour) y Maxi (Carrefour)
- **AND** la Cooperativa Obrera es la más cara del país para la lista
- **WHEN** el usuario ve Tu lista
- **THEN** el titular compara la más barata de la zona con la más cara de la zona, y la Cooperativa Obrera aparece solo en "Otras cadenas del país"

#### Scenario: Sin zona elegida
- **WHEN** no hay zona elegida
- **THEN** Tu lista compara todas las cadenas del país, como hasta ahora

### Requirement: Un producto que no se consigue en tu zona no anula la comparación
Con una zona elegida, Tu lista SHALL nombrar los productos que no vende ninguna
cadena de la zona y SHALL dejarlos afuera de los totales de la zona. Una cadena
de la zona SHALL contar como completa si tiene todos los productos que se venden
en la zona.

#### Scenario: Un producto que solo vende una cadena de otra región
- **GIVEN** la lista tiene 5 productos y ninguna cadena de la zona vende uno de ellos
- **WHEN** el usuario ve Tu lista
- **THEN** lee que ese producto no se consigue en su zona, y el titular compara las cadenas de la zona que tienen los otros 4

#### Scenario: Ningún producto se consigue en la zona
- **GIVEN** ninguna cadena de la zona vende ningún producto de la lista
- **WHEN** el usuario ve Tu lista
- **THEN** lee que en su zona no se consigue ninguno, y ve la comparación de las cadenas del país

### Requirement: Combinar cadenas dentro de tu zona
Con una zona elegida, la estimación de comprar cada producto donde está más
barato SHALL usar solo cadenas de la zona.

#### Scenario: La más barata del país está afuera de la zona
- **GIVEN** un producto de la lista es más barato en una cadena sin sucursal en la zona
- **WHEN** el usuario ve cuánto sale combinando cadenas
- **THEN** ese producto entra con el precio de la cadena más barata de la zona

### Requirement: Una zona con una sola cadena no inventa un ahorro
Con una zona elegida en la que una sola cadena vende productos de la lista, Tu
lista SHALL decir cuánto sale la lista en esa cadena y SHALL NOT mostrar un
ahorro.

#### Scenario: Rafaela
- **GIVEN** la zona es "Rafaela, Santa Fe", donde la única cadena es La Anónima
- **WHEN** el usuario ve Tu lista
- **THEN** lee cuánto le sale en La Anónima, que es la única cadena de su zona, sin un "ahorrás"

### Requirement: Cambiar la zona vuelve a cotizar la lista
Tu lista SHALL volver a cotizarse cuando el usuario cambia o borra la zona, sin
recargar la página.

#### Scenario: Borrar la zona
- **GIVEN** Tu lista muestra la comparación de "Lomas de Zamora, Buenos Aires"
- **WHEN** el usuario borra la zona
- **THEN** Tu lista pasa a comparar todas las cadenas del país
