# mismo-producto Specification

## Purpose
Mostrar cuánto cuesta un mismo producto (mismo código de barras) en cada
cadena, y con una zona elegida, cuál de las cadenas que el usuario tiene cerca
es la más barata.

## Requirements

### Requirement: El precio de un producto es el de la cadena
Mismo producto SHALL presentar un precio por cadena, que vale para todas sus
sucursales del país, y SHALL decirlo en la pantalla. No SHALL presentarlo como
el precio de una sucursal en particular, con o sin zona.

#### Scenario: Aclaración visible
- **WHEN** el usuario abre un producto
- **THEN** la pantalla dice que cada precio es el de la cadena en todo el país

### Requirement: Las cadenas de tu zona van primero
Con una zona elegida, Mismo producto SHALL separar las cadenas que tienen al
menos una sucursal en la zona de las que no, y mostrar primero las de la zona,
ordenadas de la más barata a la más cara.

#### Scenario: Producto con cadenas en la zona
- **GIVEN** la zona es "Palermo, CABA", donde hay Dia, Coto y Express (Carrefour)
- **WHEN** el usuario abre la yerba Playadito de 1 kg
- **THEN** ve primero "En tu zona" con esas tres cadenas ordenadas por precio, y después el resto de las cadenas

#### Scenario: Sin zona elegida
- **WHEN** no hay zona elegida
- **THEN** ve todas las cadenas juntas, ordenadas por precio, como hasta ahora

### Requirement: La más barata de tu zona
Con una zona elegida y al menos una cadena de la zona que venda el producto,
Mismo producto SHALL decir cuál es la más barata de la zona y cuánto más barata
es que la más cara de la zona.

#### Scenario: Titular con zona
- **GIVEN** en Palermo el producto sale $ 4.775 en Dia y $ 6.000 en Express
- **WHEN** el usuario lo abre
- **THEN** lee que en su zona la más barata es Dia, un 20% menos que Express

#### Scenario: Ninguna cadena de la zona lo vende
- **GIVEN** ninguna cadena con sucursal en la zona vende el producto
- **WHEN** el usuario lo abre
- **THEN** ve que en su zona no se consigue, y la lista de las cadenas que sí lo venden en el país

### Requirement: La búsqueda del inicio conserva la zona
Buscar un producto desde el inicio SHALL llevar a Mismo producto con la zona que
estaba elegida.

#### Scenario: Recorrido desde el inicio
- **GIVEN** el usuario eligió "Rosario, Santa Fe" en el inicio
- **WHEN** busca "aceite natura" desde el buscador del inicio
- **THEN** llega a Mismo producto con los resultados y la zona "Rosario, Santa Fe" aplicada
