# Spec Delta

## ADDED Requirements

### Requirement: Los titulares de la portada son entre súper
La cifra del día, la cadena más barata, el ahorro, lo que más subió y el ejemplo de la portada SHALL calcularse sin mayoristas, con zona o sin ella.

#### Scenario: Zona con un mayorista cerca
- **GIVEN** cerca de la zona hay Día, Coto y Maxiconsumo
- **WHEN** el usuario abre la portada
- **THEN** la cadena más barata y el ahorro son entre Día y Coto
