## ADDED Requirements

### Requirement: Tu lista se puede compartir
Tu lista SHALL tener un botón para compartirla. En el celular SHALL abrir el menú nativo con un texto legible y un link. Donde no hay menú nativo, SHALL copiar el texto y el link juntos y avisarlo. El texto SHALL decir:
- cuántos productos son, y cada uno con su cantidad;
- dónde sale menos la lista completa, nombrando la zona de quien comparte si eligió una.

El link SHALL rearmar la misma lista, con los mismos productos y cantidades.

#### Scenario: Compartir desde el celular
- **GIVEN** la lista tiene 2 yerbas y 1 aceite, y la zona es Lomas de Zamora
- **WHEN** el usuario toca "Compartir lista"
- **THEN** el menú nativo recibe un texto con "2 × Yerba…", "1 × Aceite…" y "En Lomas de Zamora, en <cadena> sale $ …", más un link a /lista con esos productos

#### Scenario: Compartir desde la computadora
- **GIVEN** el navegador no tiene menú nativo para compartir
- **WHEN** el usuario toca "Compartir lista"
- **THEN** el texto y el link quedan copiados juntos, y la página avisa que se copió

### Requirement: El link de una lista llega con tarjeta
El link de una lista compartida SHALL servirse con una tarjeta que diga que es una lista del súper y cuántos productos tiene.

#### Scenario: Una lista de 8 productos
- **WHEN** WhatsApp pide la vista previa de /lista con 8 productos en el link
- **THEN** la tarjeta dice "Lista del súper · 8 productos"
