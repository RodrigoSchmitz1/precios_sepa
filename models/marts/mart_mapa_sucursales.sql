-- Sucursales con coordenadas para el mapa. La clave sucursal es la que lista mart_mapa_promos.

SELECT
    CONCAT(s.id_comercio, "-", s.id_sucursal) AS sucursal,
    c.nombre_comercial AS cadena,
    s.nombre_sucursal,
    s.calle,
    s.numero,
    s.barrio,
    s.localidad,
    s.provincia,
    s.latitud,
    s.longitud
FROM {{ ref("stg_sucursales") }} AS s
-- Por id_comercio + id_bandera: solo por id_comercio multiplicaria la sucursal por bandera.
LEFT JOIN {{ ref("stg_comercio") }} AS c
    ON s.id_comercio = c.id_comercio
    AND s.id_bandera = c.id_bandera
WHERE s.latitud IS NOT NULL
    AND s.longitud IS NOT NULL
