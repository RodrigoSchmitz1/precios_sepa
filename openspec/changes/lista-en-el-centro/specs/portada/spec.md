## ADDED Requirements

### Requirement: La portada arranca por tu lista
Si el usuario tiene productos en su lista, la portada SHALL mostrar debajo del buscador cuánto sale su lista en la cadena más barata: con zona, entre las cadenas cerca; sin zona, en el país. La tarjeta SHALL llevar a Tu lista. Sin lista, la portada NO SHALL mostrarla.

#### Scenario: Con lista y zona
- **GIVEN** la zona es Tres Arroyos y la lista tiene 8 productos, más baratos en Vea a $ 41.575
- **WHEN** el usuario abre la portada
- **THEN** debajo del buscador ve "Tu lista · 8 productos: en Vea te sale $ 41.575", que lo lleva a Tu lista

#### Scenario: Sin lista
- **GIVEN** el usuario no tiene productos en su lista
- **WHEN** abre la portada
- **THEN** no ve la tarjeta de su lista
