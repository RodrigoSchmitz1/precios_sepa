# Spec Delta

## Purpose

Que el sitio no publique un mercado incompleto como si estuviera completo:
cuando la fuente llega sin una cadena, se usa su último precio reciente, se dice
de qué fecha es y no se toca la historia.

## ADDED Requirements

### Requirement: Una cadena que falta usa su precio más reciente
Si una cadena que tenía precios en alguno de los 2 días anteriores falta en el
último día, los precios del último día SHALL incluir sus precios de la fecha
más reciente en que los tuvo, cada uno con esa fecha como `fecha_precio`. El
tope de días SHALL vivir en un solo lugar, que leen dbt, la API y los textos.

#### Scenario: Cencosud falta el 11-11
- **GIVEN** Jumbo, Disco y Vea tienen precios el 2026-11-10 y no el 2026-11-11
- **WHEN** se arman los precios del 2026-11-11
- **THEN** Jumbo, Disco y Vea aparecen con sus precios del 2026-11-10 y `fecha_precio` 2026-11-10, y las demás cadenas con `fecha_precio` 2026-11-11

#### Scenario: Más de 2 días sin la cadena
- **GIVEN** una cadena tuvo precios por última vez el 2026-11-08
- **WHEN** se arman los precios del 2026-11-11
- **THEN** esa cadena no aparece

### Requirement: La historia guarda lo que publicó SEPA
Los históricos (`historico_quien_gana`, `historico_precios_cadena_categoria`) y
el índice de inflación SHALL NOT incluir precios arrastrados.

#### Scenario: Histórico del 11-11
- **GIVEN** Cencosud falta el 2026-11-11 y su precio se arrastra en Mismo producto
- **WHEN** se lee `historico_quien_gana` del 2026-11-11
- **THEN** tiene 11 cadenas, sin Jumbo, Disco ni Vea

### Requirement: El sitio avisa qué cadenas no son del día
Cuando hay cadenas arrastradas, Mismo producto, Más barato y la portada SHALL
mostrar un aviso que nombra esas cadenas y la fecha de sus precios, con fecha en
formato argentino. Sin cadenas arrastradas, el aviso SHALL NOT aparecer.

#### Scenario: Aviso con Cencosud arrastrada
- **GIVEN** Jumbo, Disco y Vea se muestran con precios del 2026-11-10
- **WHEN** el usuario abre Más barato
- **THEN** lee que SEPA no publicó hoy los precios de Jumbo, Disco y Vea y que se muestran los del 10/11

#### Scenario: Día completo
- **GIVEN** todas las cadenas tienen precios del último día
- **WHEN** el usuario abre cualquier página
- **THEN** no ve ningún aviso de cadenas faltantes

### Requirement: Un arrastre viejo rompe el pipeline
El pipeline SHALL fallar si algún precio publicado como del último día tiene un
`fecha_precio` más viejo que el tope.

#### Scenario: Arrastre de 3 días
- **GIVEN** el mart tiene una fila con `fecha_precio` 3 días antes que `fecha_datos`
- **WHEN** corre `dbt test`
- **THEN** el test falla y el workflow queda en rojo
