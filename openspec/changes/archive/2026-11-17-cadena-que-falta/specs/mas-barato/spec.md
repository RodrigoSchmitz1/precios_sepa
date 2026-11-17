# Spec Delta

## Purpose

Decir qué cadena tiene el precio más bajo más seguido en cada categoría, con el
mismo conjunto de cadenas y precios que Mismo producto.

## ADDED Requirements

### Requirement: La vista nacional usa las cadenas de Mismo producto
La vista nacional de Más barato SHALL calcular el ganador de cada categoría con
todas las cadenas que tienen precios en Mismo producto, incluidas las
arrastradas, y con la misma regla que la vista de la zona.

#### Scenario: Día sin Cencosud
- **GIVEN** el 2026-11-11 Jumbo, Disco y Vea se muestran con precios del 2026-11-10
- **WHEN** el usuario abre Más barato sin zona
- **THEN** Jumbo, Disco y Vea compiten en cada categoría

#### Scenario: Día completo
- **GIVEN** todas las cadenas tienen precios del último día
- **WHEN** el usuario abre Más barato sin zona
- **THEN** el ganador de cada categoría y sus porcentajes coinciden con `mart_quien_gana` de ese día
