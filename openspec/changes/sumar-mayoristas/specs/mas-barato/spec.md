# Spec Delta

## MODIFIED Requirements

### Requirement: La vista nacional usa las cadenas de Mismo producto
La vista nacional de Más barato SHALL calcular el ganador de cada categoría con
todas las cadenas que tienen precios en Mismo producto, incluidas las
arrastradas, salvo los mayoristas, y con la misma regla que la vista de la zona.

#### Scenario: Día sin Cencosud
- **GIVEN** el 2026-11-11 Jumbo, Disco y Vea se muestran con precios del 2026-11-10
- **WHEN** el usuario abre Más barato sin zona
- **THEN** Jumbo, Disco y Vea compiten en cada categoría

#### Scenario: Día completo
- **GIVEN** todas las cadenas tienen precios del último día
- **WHEN** el usuario abre Más barato sin zona
- **THEN** el ganador de cada categoría y sus porcentajes coinciden con `mart_quien_gana` de ese día

#### Scenario: Un mayorista no gana una categoría
- **GIVEN** Nini tiene el precio por unidad más bajo de una categoría
- **WHEN** el usuario abre Más barato, con zona o sin ella
- **THEN** Nini no aparece y el ganador es una cadena de súper
