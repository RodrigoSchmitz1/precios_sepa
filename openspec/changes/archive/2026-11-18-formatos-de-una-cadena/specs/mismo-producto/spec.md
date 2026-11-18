## ADDED Requirements

### Requirement: Los formatos de una cadena con el mismo precio van en una fila
En el detalle de un producto, los formatos de una misma cadena que tienen exactamente el mismo precio SHALL ir en una sola fila, con sus nombres y la suma de sus sucursales. Los formatos que cobran distinto SHALL seguir en filas separadas. Son formatos de una cadena Carrefour, Market y Express, y Changomás, SuperChangomás e HiperChangomás. Maxi, Vea, Disco y Jumbo NO SHALL agruparse.

#### Scenario: Dos formatos al mismo precio
- **GIVEN** la yerba cuesta $ 2.700 en Changomás y en HiperChangomás, y $ 2.600 en SuperChangomás
- **WHEN** el usuario abre el detalle
- **THEN** ve una fila "Changomás · HiperChangomás" a $ 2.700 y otra fila SuperChangomás a $ 2.600

#### Scenario: Maxi no se agrupa
- **GIVEN** el producto cuesta lo mismo en Carrefour y en Maxi (Carrefour)
- **WHEN** el usuario abre el detalle
- **THEN** Carrefour y Maxi van en filas separadas

#### Scenario: Un precio no creíble no se agrupa con uno creíble
- **GIVEN** Market tiene el mismo número que Carrefour, pero marcado fuera de la comparación
- **WHEN** el usuario abre el detalle
- **THEN** cada uno va en su fila, con su marca

### Requirement: Las cadenas se nombran completas
Donde Mismo producto nombra las cadenas de un precio (el titular, los extremos y "en todo el país"), SHALL decir sus nombres en lugar de "y N más": hasta tres nombres con "y", y con más de tres, tres nombres y "y N más". Los formatos de una cadena con el mismo precio SHALL nombrarse juntos, como una sola.

#### Scenario: Dos cadenas al precio más bajo
- **GIVEN** el precio más bajo lo tienen Changomás e HiperChangomás
- **WHEN** el usuario lee el titular
- **THEN** dice "Changomás · HiperChangomás" y no "Changomás y 1 más"

#### Scenario: Cinco cadenas
- **GIVEN** el precio más alto lo tienen Coto, Día, Vea, Disco y Jumbo
- **WHEN** el usuario lee el extremo caro
- **THEN** dice "Coto, Día, Vea y 2 más"
