## ADDED Requirements

### Requirement: La zona se busca por palabras
El buscador de zonas SHALL encontrar una zona cuando cada palabra tipeada es el comienzo de una palabra de su nombre o de alguno de sus alias. SHALL ignorar mayúsculas, tildes y las palabras "de", "del", "la", "las", "los" y "el".

#### Scenario: Sin el "de"
- **WHEN** el usuario busca "lomas zamora"
- **THEN** ve "Lomas de Zamora, Buenos Aires" entre las opciones

#### Scenario: Comienzo de palabra
- **WHEN** el usuario busca "villa lug"
- **THEN** ve la zona de Villa Lugano

### Requirement: Un mismo lugar con nombres parecidos es una sola zona
Dos lugares de la misma provincia con centros a menos de 2 km SHALL ser una sola zona cuando las palabras de un nombre, sin contar las vacías, están contenidas en las del otro. La zona SHALL llevar el nombre del lugar con más sucursales y SHALL conservar los otros nombres como alias. Un link con un alias SHALL abrir esa zona.

#### Scenario: Laferrere
- **GIVEN** las sucursales cargan "Laferrere", "Gregorio de Laferrere" y "Gregorio Laferrere", a menos de 1,5 km
- **WHEN** el usuario busca "laferrere"
- **THEN** ve una sola opción

#### Scenario: Un link con un nombre viejo
- **GIVEN** un link compartido trae `?zona=AR-B:Gregorio Laferrere`
- **WHEN** alguien lo abre
- **THEN** la zona elegida es la de Laferrere, sin aviso de zona inexistente

#### Scenario: Un barrio buscado por su nombre
- **GIVEN** "Nueva Córdoba" quedó como alias de la zona Córdoba
- **WHEN** el usuario busca "nueva cordoba"
- **THEN** ve la zona Córdoba
