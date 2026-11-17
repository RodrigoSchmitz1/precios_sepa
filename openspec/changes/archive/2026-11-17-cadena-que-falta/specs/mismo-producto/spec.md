# Spec Delta

## Purpose

Mostrar cuánto cuesta un mismo producto en cada cadena, y decir de qué fecha es
cada precio cuando no es del último día.

## ADDED Requirements

### Requirement: El precio arrastrado dice su fecha
En un producto, cada cadena cuyo precio sale de otro día SHALL mostrar de qué
fecha es ese precio, junto al precio. Las cadenas con precio del día SHALL NOT
llevar fecha.

#### Scenario: Producto con Jumbo arrastrada
- **GIVEN** el último día es el 2026-11-11 y Jumbo se muestra con su precio del 2026-11-10
- **WHEN** el usuario abre un producto que vende Jumbo
- **THEN** la fila de Jumbo dice "precio del 10/11" y las demás filas no dicen fecha

### Requirement: Los precios arrastrados cuentan en la brecha
Los precios arrastrados SHALL contar para la referencia del mercado, para la
credibilidad y para la cadena más barata y la más cara, igual que los del día.

#### Scenario: Cencosud era la más cara
- **GIVEN** un producto cuya cadena más cara es Disco, con precio del día anterior
- **WHEN** el usuario lo abre
- **THEN** la diferencia entre la más barata y la más cara se calcula contra Disco
