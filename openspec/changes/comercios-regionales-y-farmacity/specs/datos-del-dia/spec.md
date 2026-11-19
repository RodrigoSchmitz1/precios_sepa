## ADDED Requirements

### Requirement: Se cargan todos los supermercados que informa SEPA
El pipeline SHALL cargar todos los comercios de SEPA minoristas que venden como supermercado: las cadenas nacionales y los regionales (Toledo, Comodín, Mariano Max, California, La Agrícola Regional y Unicoop). SHALL cargar también Farmacity, marcada como farmacia. SHALL dejar afuera las tiendas de estaciones de servicio. Cada bandera SHALL mostrarse con su nombre comercial, sin los espacios ni la escritura cruda del archivo de SEPA.

#### Scenario: Un supermercado regional aparece en su ciudad
- **WHEN** el usuario busca un producto que Toledo informa
- **THEN** Toledo aparece entre las cadenas con su precio, escrita "Toledo"

#### Scenario: Una estación de servicio no entra
- **WHEN** SEPA publica precios de Axion
- **THEN** el pipeline no los carga

### Requirement: Un comercio que no informa todos los días no rompe el pipeline
Un comercio marcado como de informe intermitente SHALL quedar afuera del control de cadenas completas del último día. En la semana medida eran Farmacity y La Agrícola Regional. Los días que falta, SHALL usarse su precio más reciente dentro del tope de arrastre, como con cualquier cadena que falta, y el sitio SHALL decir que ese precio no es del día. Para el resto de los comercios, el control SHALL seguir fallando como hasta ahora.

#### Scenario: Farmacity no viene un día
- **GIVEN** el ZIP del día no trae a Farmacity
- **WHEN** corre el pipeline
- **THEN** los tests pasan, y los precios de Farmacity se muestran con la fecha del día en que se informaron

#### Scenario: Falta una cadena grande
- **GIVEN** el ZIP del día no trae a Cencosud
- **WHEN** corre el pipeline
- **THEN** el control de cadenas completas falla, como hasta ahora
