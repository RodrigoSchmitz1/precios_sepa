## MODIFIED Requirements

### Requirement: Una zona con una sola cadena no inventa una comparación
Con una zona elegida en la que SEPA informa una sola cadena cerca, la portada SHALL decirlo y SHALL mostrar cuánto sale ahí la canasta básica, sin un porcentaje de ahorro ni un ranking. SHALL decir también a cuántos km está la sucursal más cercana de otra cadena. Si esa cadena tiene total en el ranking nacional de la canasta, SHALL decir cuánto sale la misma canasta en la cadena más barata del país y cuánto menos es, presentado como lo que cuesta no tener opciones y no como un ahorro al alcance. Si no tiene total, NO SHALL mostrar esa cifra.

#### Scenario: Rafaela
- **GIVEN** la zona es "Rafaela, Santa Fe", donde la única cadena cerca es La Anónima
- **WHEN** el usuario abre la portada
- **THEN** lee que cerca de su zona SEPA informa solo La Anónima y cuánto sale ahí la canasta básica, sin un "ahorrás"

#### Scenario: Lo que cuesta no tener opciones
- **GIVEN** la zona es "Rafaela, Santa Fe", la otra cadena más cercana está a 50 km, y en el ranking nacional la canasta sale 14% menos en Maxi (Carrefour) que en La Anónima
- **WHEN** el usuario abre la portada
- **THEN** lee que la otra cadena más cercana está a unos 50 km y que en Maxi (Carrefour), la más barata del país, la misma canasta sale 14% menos

#### Scenario: Una cadena sin total nacional
- **GIVEN** la única cadena cerca es la Cooperativa Obrera, que no tiene total en el ranking nacional
- **WHEN** el usuario abre la portada
- **THEN** lee que es la única cadena cerca y a cuántos km está la otra más cercana, sin una comparación con la más barata del país
