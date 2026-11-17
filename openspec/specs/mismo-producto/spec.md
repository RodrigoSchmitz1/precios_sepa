# mismo-producto Specification

## Purpose
Mostrar cuánto cuesta un mismo producto (mismo código de barras) en cada
cadena, y con una zona elegida, cuál de las cadenas que el usuario tiene cerca
es la más barata.

## Requirements

### Requirement: El precio de un producto es el de la cadena
Mismo producto SHALL presentar un precio por cadena, que vale para todas sus
sucursales del país, y SHALL decirlo en la pantalla. No SHALL presentarlo como
el precio de una sucursal en particular, con o sin zona.

#### Scenario: Aclaración visible
- **WHEN** el usuario abre un producto
- **THEN** la pantalla dice que cada precio es el de la cadena en todo el país

### Requirement: Las cadenas de tu zona van primero
Con una zona elegida, Mismo producto SHALL separar las cadenas que tienen al
menos una sucursal en la zona de las que no, y mostrar primero las de la zona,
ordenadas de la más barata a la más cara.

#### Scenario: Producto con cadenas en la zona
- **GIVEN** la zona es "Palermo, CABA", donde hay Dia, Coto y Express (Carrefour)
- **WHEN** el usuario abre la yerba Playadito de 1 kg
- **THEN** ve primero "En tu zona" con esas tres cadenas ordenadas por precio, y después el resto de las cadenas

#### Scenario: Sin zona elegida
- **WHEN** no hay zona elegida
- **THEN** ve todas las cadenas juntas, ordenadas por precio, como hasta ahora

### Requirement: La más barata de tu zona
Con una zona elegida y al menos una cadena de la zona que venda el producto,
Mismo producto SHALL decir en el titular cuál es la más barata de la zona y
cuánto más barata es que la más cara de la zona. No SHALL repetirlo en un
recuadro aparte.

#### Scenario: Titular con zona
- **GIVEN** en Palermo el producto sale $ 4.775 en Dia y $ 6.000 en Express
- **WHEN** el usuario lo abre
- **THEN** el titular dice que en su zona la más barata es Dia, un 20% menos que Express

#### Scenario: Ninguna cadena de la zona lo vende
- **GIVEN** ninguna cadena con sucursal en la zona vende el producto
- **WHEN** el usuario lo abre
- **THEN** ve que en su zona no se consigue, y la lista de las cadenas que sí lo venden en el país

### Requirement: La búsqueda del inicio conserva la zona
Buscar un producto desde el inicio SHALL llevar a Mismo producto con la zona que
estaba elegida.

#### Scenario: Recorrido desde el inicio
- **GIVEN** el usuario eligió "Rosario, Santa Fe" en el inicio
- **WHEN** busca "aceite natura" desde el buscador del inicio
- **THEN** llega a Mismo producto con los resultados y la zona "Rosario, Santa Fe" aplicada

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

### Requirement: Tu lista compara las cadenas de tu zona
Con una zona elegida, Tu lista SHALL armar su titular, el ahorro y la lista de
cadenas con todos los productos usando solo las cadenas que tienen al menos una
sucursal en la zona. Las cadenas sin sucursal en la zona SHALL ir en una sección
aparte, sin entrar en el ahorro.

#### Scenario: Lomas de Zamora
- **GIVEN** la zona es "Lomas de Zamora, Buenos Aires", donde hay Carrefour, Coto, Dia, Disco, Express (Carrefour) y Maxi (Carrefour)
- **AND** la Cooperativa Obrera es la más cara del país para la lista
- **WHEN** el usuario ve Tu lista
- **THEN** el titular compara la más barata de la zona con la más cara de la zona, y la Cooperativa Obrera aparece solo en "Otras cadenas del país"

#### Scenario: Sin zona elegida
- **WHEN** no hay zona elegida
- **THEN** Tu lista compara todas las cadenas del país, como hasta ahora

### Requirement: Un producto que no se consigue en tu zona no anula la comparación
Con una zona elegida, Tu lista SHALL nombrar los productos que no vende ninguna
cadena de la zona y SHALL dejarlos afuera de los totales de la zona. Una cadena
de la zona SHALL contar como completa si tiene todos los productos que se venden
en la zona.

#### Scenario: Un producto que solo vende una cadena de otra región
- **GIVEN** la lista tiene 5 productos y ninguna cadena de la zona vende uno de ellos
- **WHEN** el usuario ve Tu lista
- **THEN** lee que ese producto no se consigue en su zona, y el titular compara las cadenas de la zona que tienen los otros 4

#### Scenario: Ningún producto se consigue en la zona
- **GIVEN** ninguna cadena de la zona vende ningún producto de la lista
- **WHEN** el usuario ve Tu lista
- **THEN** lee que en su zona no se consigue ninguno, y ve la comparación de las cadenas del país

### Requirement: Combinar cadenas dentro de tu zona
Con una zona elegida, la estimación de comprar cada producto donde está más
barato SHALL usar solo cadenas de la zona.

#### Scenario: La más barata del país está afuera de la zona
- **GIVEN** un producto de la lista es más barato en una cadena sin sucursal en la zona
- **WHEN** el usuario ve cuánto sale combinando cadenas
- **THEN** ese producto entra con el precio de la cadena más barata de la zona

### Requirement: Una zona con una sola cadena no inventa un ahorro
Con una zona elegida en la que una sola cadena vende productos de la lista, Tu
lista SHALL decir cuánto sale la lista en esa cadena y SHALL NOT mostrar un
ahorro.

#### Scenario: Rafaela
- **GIVEN** la zona es "Rafaela, Santa Fe", donde la única cadena es La Anónima
- **WHEN** el usuario ve Tu lista
- **THEN** lee cuánto le sale en La Anónima, que es la única cadena de su zona, sin un "ahorrás"

### Requirement: Cambiar la zona vuelve a cotizar la lista
Tu lista SHALL volver a cotizarse cuando el usuario cambia o borra la zona, sin
recargar la página.

#### Scenario: Borrar la zona
- **GIVEN** Tu lista muestra la comparación de "Lomas de Zamora, Buenos Aires"
- **WHEN** el usuario borra la zona
- **THEN** Tu lista pasa a comparar todas las cadenas del país

### Requirement: La búsqueda encuentra palabras, no pedazos
Cada palabra buscada SHALL coincidir con el comienzo de una palabra del producto
(su descripción, su marca, su tamaño o como lo llama alguna cadena). Una palabra
buscada SHALL NOT coincidir con el medio de una palabra. El plural SHALL
encontrar el singular.

#### Scenario: Pan no es empanada
- **WHEN** el usuario busca "pan"
- **THEN** no aparecen tapas de empanada, y los pañales (que sin tilde empiezan con "pan") van después de todo lo que dice "pan" entero

#### Scenario: Una palabra empezada
- **WHEN** el usuario busca "gall"
- **THEN** aparecen galletitas

#### Scenario: Plural
- **GIVEN** un producto que se llama "HUEVO BLANCO AVICOPER CARTON X 30 UNI"
- **WHEN** el usuario busca "huevos"
- **THEN** ese producto aparece

### Requirement: La búsqueda tolera la ortografía
La búsqueda SHALL tratar como iguales la b y la v, la s, la z y la c antes de e o
de i, la y y la ll, y SHALL ignorar la h. La comparación SHALL seguir sin
distinguir mayúsculas ni tildes.

#### Scenario: Yerva
- **WHEN** el usuario busca "yerva"
- **THEN** aparecen los mismos productos que buscando "yerba"

### Requirement: La categoría buscada va primero
Los resultados SHALL ir primero si la categoría del producto tiene alguna
palabra buscada entera, con su plural. Entre ellos SHALL ir primero los de la
categoría que la búsqueda nombra entera.

#### Scenario: Leche
- **WHEN** el usuario busca "leche"
- **THEN** los primeros resultados son de la categoría Leche fluida, y los chocolates y golosinas con leche van después

#### Scenario: Huevos
- **WHEN** el usuario busca "huevos"
- **THEN** los primeros resultados son de la categoría Huevos, y el huevo Kinder va después

#### Scenario: Pan antes que pan rallado
- **WHEN** el usuario busca "pan"
- **THEN** la categoría Pan va antes que Rebozadores y pan rallado, y ninguna de las dos coincide con Panales

### Requirement: Después, el nombre que muestra la página
Dentro del mismo nivel de categoría, SHALL ir primero el producto cuyo nombre
visible tiene todas las palabras buscadas, después el que las tiene enteras, y
a igualdad el que venden más cadenas y el de descripción más corta.

#### Scenario: Una búsqueda que ya andaba
- **WHEN** el usuario busca "fideos"
- **THEN** los resultados siguen siendo fideos, primero los que dicen FIDEOS en su nombre

### Requirement: El resultado entra en la primera pantalla
Cuando hay una búsqueda de 2 letras o más, un producto elegido o una lista
guardada, Mismo producto SHALL mostrar su titular en versión compacta, sin
bajada. En un celular de 414x896 el primer resultado SHALL empezar antes de los
320 px.

#### Scenario: Buscar desde el celular
- **WHEN** el usuario busca "yerba playadito" en un celular
- **THEN** el primer resultado se ve sin bajar la pantalla

#### Scenario: Primera visita sin nada
- **GIVEN** no hay búsqueda, producto elegido ni lista guardada
- **WHEN** el usuario entra a Mismo producto
- **THEN** ve el titular completo, con la cifra del día y la bajada

### Requirement: Con zona, el titular del producto es el de la zona
Con una zona elegida y al menos una cadena de la zona que venda el producto con
precio creíble, el titular del producto, la tira de precios y las tarjetas de
cifras SHALL usar solo las cadenas de la zona. Debajo de las tarjetas, una línea
SHALL decir el rango de precios del país.

#### Scenario: Lomas de Zamora
- **GIVEN** la zona es "Lomas de Zamora, Buenos Aires" y el producto es la Playadito de 1 kg
- **WHEN** el usuario lo abre
- **THEN** el titular, la tira y las tarjetas nombran solo cadenas con sucursal en Lomas de Zamora, y Vea aparece solo en la línea del país y en la lista de otras cadenas del país

#### Scenario: Ninguna cadena de la zona lo vende
- **GIVEN** ninguna cadena con sucursal en la zona vende el producto
- **WHEN** el usuario lo abre
- **THEN** el titular dice que en su zona no se consigue, y las tarjetas muestran los precios del país

### Requirement: Una diferencia chica se dice como chica
Cuando la cadena más cara cobra menos de un 5% más que la más barata, el titular
del producto SHALL decir que cuesta casi lo mismo y la diferencia en pesos, sin
destacar el porcentaje. Vale para la comparación de la zona y para la del país.

#### Scenario: Playadito con 3% de diferencia
- **GIVEN** un producto que cuesta $ 5.079 en la más barata y $ 5.250 en la más cara
- **WHEN** el usuario lo abre
- **THEN** el titular dice que cuesta casi lo mismo en todas, con una diferencia de $ 171
