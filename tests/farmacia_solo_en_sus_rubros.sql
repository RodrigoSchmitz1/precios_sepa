-- Falla si una farmacia aparece en Mas barato o en la comparacion por categoria
-- fuera de var('rubros_farmacia'), o en los precios de Tu canasta.
--
-- Farmacity entro el 2026-11-19 (openspec comercios-regionales-y-farmacity)
-- como farmacia: compara sus productos en El mismo producto, pero no vende una
-- compra de super. Unos chocolates sueltos no la tienen que hacer "ganar"
-- Golosinas, ni un shampoo meterla en la canasta del mes. El filtro vive en la
-- macro compite_en_rubro y en los marts de la canasta; este test lo vigila
-- desde afuera para que un cambio en un mart no lo saltee en silencio.
--
-- Lee marts chicos (decenas de MB entre los tres) y el seed.

WITH farmacias AS (
    SELECT DISTINCT nombre_comercial AS cadena
    FROM {{ ref("stg_comercio") }}
    WHERE formato = 'farmacia'
)

SELECT 'mart_quien_gana' AS modelo, q.cadena, q.categoria, q.rubro
FROM {{ ref("mart_quien_gana") }} AS q
JOIN farmacias USING (cadena)
WHERE q.rubro NOT IN ({% for r in var('rubros_farmacia') %}'{{ r }}'{% if not loop.last %}, {% endif %}{% endfor %})

UNION ALL

SELECT 'mart_precios_cadena_categoria', p.cadena, p.categoria, CAST(NULL AS STRING)
FROM {{ ref("mart_precios_cadena_categoria") }} AS p
JOIN farmacias USING (cadena)
JOIN (SELECT DISTINCT categoria, rubro FROM {{ ref("stg_categorias") }}) AS c USING (categoria)
WHERE c.rubro NOT IN ({% for r in var('rubros_farmacia') %}'{{ r }}'{% if not loop.last %}, {% endif %}{% endfor %})

UNION ALL

SELECT 'mart_precio_categoria_sucursal', s.cadena, s.categoria, CAST(NULL AS STRING)
FROM {{ ref("mart_precio_categoria_sucursal") }} AS s
JOIN farmacias USING (cadena)
