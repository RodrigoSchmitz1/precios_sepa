## ADDED Requirements

### Requirement: La farmacia compara sus productos pero no compite en Tu lista
En el detalle de un producto, la farmacia SHALL aparecer con su precio como una cadena más, identificada como farmacia. Si tiene sucursal cerca de la zona, SHALL figurar entre los precios de la zona. Los totales por cadena de Tu lista, la más barata de la lista y el total combinando cadenas SHALL calcularse solo con supermercados.

#### Scenario: Un shampoo que vende Farmacity
- **WHEN** el usuario abre un shampoo que informan Farmacity, Coto y Día
- **THEN** ve los tres precios, y Farmacity identificada como farmacia

#### Scenario: Tu lista con productos de perfumería
- **GIVEN** la lista tiene yerba, aceite y un shampoo, y hay un Farmacity cerca
- **WHEN** se cotiza la lista
- **THEN** los totales comparan solo supermercados, y Farmacity no aparece como opción
