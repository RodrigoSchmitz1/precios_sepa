## ADDED Requirements

### Requirement: Las cadenas de tu zona son las que están cerca
Las cadenas de una zona SHALL ser las que tienen sucursal en el lugar más las que tienen una sucursal a menos de 3 km de su centro. El radio SHALL ser el mismo que usan las promos cercanas. Todas las páginas que comparan entre "las cadenas de tu zona" SHALL usar esa misma lista. El selector de zona SHALL decir cuántas cadenas hay cerca.

#### Scenario: Un barrio porteño con una sola sucursal adentro
- **GIVEN** Villa Soldati tiene adentro solo sucursales de Día, y a menos de 3 km de su centro hay Coto, Carrefour y otras
- **WHEN** el usuario elige Villa Soldati
- **THEN** su zona tiene todas esas cadenas, y ninguna página dice que hay una sola cadena

#### Scenario: Una ciudad sin otra cadena cerca
- **GIVEN** en Rafaela la única cadena es La Anónima y la otra más cercana está a más de 3 km
- **WHEN** el usuario elige Rafaela
- **THEN** su zona tiene solo La Anónima

#### Scenario: El selector
- **WHEN** el usuario busca "Villa Soldati"
- **THEN** la opción dice cuántas cadenas hay cerca, contando las que están a menos de 3 km
