# Spec Delta

## Purpose

Mostrar los descuentos vigentes que publican las cadenas, empezando por los que
el usuario tiene cerca.

## ADDED Requirements

### Requirement: Promos arranca en tu zona
Con una zona elegida, el mapa de promos SHALL abrir centrado en la zona y la
lista SHALL mostrar las promos de esa zona. Sin zona, SHALL abrir como hasta
ahora.

#### Scenario: Abrir promos con zona
- **GIVEN** la zona es "Palermo, CABA"
- **WHEN** el usuario abre Promos
- **THEN** el mapa está centrado en Palermo y la lista muestra las promos de esa zona

### Requirement: Mover el mapa no cambia la zona
Mover el mapa o buscar otro lugar desde el mapa SHALL cambiar lo que se ve en
Promos, pero no la zona del usuario.

#### Scenario: Mirar promos de otro lado
- **GIVEN** la zona es "Palermo, CABA"
- **WHEN** el usuario arrastra el mapa hasta Belgrano
- **THEN** ve las promos de Belgrano, y el encabezado sigue diciendo "Palermo, CABA"
