-- Falla si una sucursal mayorista queda sin coordenadas (openspec sumar-mayoristas).
--
-- Makro publica sus sucursales con latitud y sin longitud; la ubicacion sale de
-- seeds/coordenadas_sucursales.csv (OpenStreetMap, revisada a mano). Si un
-- mayorista suma una sucursal sin coordenadas y nadie la carga en el seed, la
-- sucursal no aparece en el mapa ni cuenta para "mayoristas cerca": este test
-- lo dice nombrandola, para agregarla al seed.
--
-- Con el interruptor apagado no hay sucursales mayoristas en staging y no
-- devuelve nada. Lee dos dimensiones chicas.

SELECT
    s.id_comercio,
    s.id_bandera,
    s.id_sucursal,
    s.nombre_sucursal,
    s.localidad
FROM {{ ref("stg_sucursales") }} AS s
JOIN {{ ref("stg_comercio") }} AS c
    ON s.id_comercio = c.id_comercio
    AND s.id_bandera = c.id_bandera
WHERE c.formato = 'mayorista'
    AND (s.latitud IS NULL OR s.longitud IS NULL)
