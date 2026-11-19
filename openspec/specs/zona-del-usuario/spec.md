# zona-del-usuario Specification

## Purpose
Que el usuario diga una sola vez dónde compra y que todo el sitio lo use: la
zona se elige, se ve, se recuerda, se comparte y se borra igual en todas las
páginas.

## Requirements

### Requirement: La zona es un lugar con sucursales
Una zona SHALL ser un barrio o una localidad de la lista de lugares con
sucursales, identificada por su nombre y su provincia, con un punto central.
Dos lugares con el mismo nombre en provincias distintas SHALL ser zonas
distintas.

#### Scenario: Localidades homónimas
- **WHEN** el usuario busca "San Martín"
- **THEN** ve una opción por cada provincia donde hay un lugar con ese nombre, cada una con su provincia escrita

#### Scenario: Un lugar sin sucursales no se ofrece
- **WHEN** el usuario busca un pueblo donde ninguna cadena informa sucursales
- **THEN** no aparece entre las opciones, y el buscador dice que no hay sucursales ahí

### Requirement: Elegir la zona buscando
El sitio SHALL permitir elegir la zona escribiendo parte del nombre del barrio
o la localidad, sin distinguir mayúsculas ni tildes.

#### Scenario: Búsqueda sin tildes
- **WHEN** el usuario escribe "nunez"
- **THEN** aparece "Nuñez, CABA" (como lo escribe el GCBA) entre las opciones

### Requirement: Elegir la zona con la ubicación del teléfono
El sitio SHALL ofrecer "usar mi ubicación" y, si el usuario la comparte, elegir
el lugar con sucursales más cercano a ese punto. Si no la comparte o falla,
SHALL decirlo y dejar la búsqueda a mano.

#### Scenario: Ubicación compartida
- **WHEN** el usuario toca "usar mi ubicación" y el teléfono la comparte desde Palermo
- **THEN** la zona queda en "Palermo, CABA"

#### Scenario: Ubicación rechazada
- **WHEN** el usuario rechaza el permiso de ubicación
- **THEN** el sitio muestra que no pudo leerla y deja el buscador de lugares a la vista

### Requirement: La zona se ve en todas las páginas
Con una zona elegida, el encabezado de todas las páginas SHALL mostrarla y
permitir cambiarla o borrarla desde ahí. Sin zona, SHALL invitar a elegirla.

#### Scenario: Zona visible al navegar
- **GIVEN** la zona es "Palermo, CABA"
- **WHEN** el usuario pasa del inicio a Mismo producto y después a Promos
- **THEN** en las tres páginas el encabezado dice "Palermo, CABA"

#### Scenario: Borrar la zona
- **WHEN** el usuario borra la zona desde el encabezado
- **THEN** todas las páginas vuelven a mostrar datos de todo el país y el encabezado invita a elegir una

### Requirement: La zona se recuerda en el navegador
La zona elegida SHALL seguir elegida al volver al sitio otro día desde el mismo
navegador. Si el navegador no permite guardar, el sitio SHALL funcionar igual y
la zona SHALL durar mientras la página esté abierta.

#### Scenario: Volver al día siguiente
- **GIVEN** el usuario eligió "Rosario, Santa Fe" ayer
- **WHEN** abre el sitio hoy en el mismo navegador
- **THEN** la zona ya está en "Rosario, Santa Fe"

#### Scenario: Navegador sin almacenamiento
- **GIVEN** un navegador en modo privado que no deja guardar
- **WHEN** el usuario elige una zona y navega entre páginas
- **THEN** la zona se mantiene mientras no recargue, y nada se rompe

### Requirement: La zona viaja en el link compartido
Un link copiado o compartido desde el sitio SHALL incluir la zona. Al abrir un
link con zona, esa zona SHALL aplicarse y recordarse, por encima de la que
hubiera guardada.

#### Scenario: Link con zona
- **GIVEN** el usuario tiene guardada "Córdoba, Córdoba"
- **WHEN** abre un link que le mandaron con la zona "Palermo, CABA"
- **THEN** ve la página con "Palermo, CABA" y esa queda como su zona

#### Scenario: Link con una zona que ya no existe
- **WHEN** alguien abre un link con una zona que no está en la lista de lugares
- **THEN** el sitio la ignora, avisa que no la encontró y usa la zona guardada o ninguna

### Requirement: Cada página dice si usa la zona
Toda página que muestre precios, promos o rankings SHALL decir si lo que muestra
es de la zona elegida o de todo el país.

#### Scenario: Página nacional con zona elegida
- **GIVEN** la zona es "Palermo, CABA"
- **WHEN** el usuario abre una página que solo tiene datos nacionales
- **THEN** la página dice que sus datos son de todo el país

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
