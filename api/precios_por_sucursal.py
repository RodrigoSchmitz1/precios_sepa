"""Precios por sucursal en memoria, para optimizar la compra de la canasta.

Carga mart_precio_categoria_sucursal una vez cada 6 horas y arma un indice por
sucursal. Optimizar es un problema de busqueda sobre esos precios, no una
consulta: resolverlo en BigQuery seria una query por visitante y por cada cambio
de radio, que es justo lo que la cuota diaria no aguanta.

Este modulo no conoce BigQuery: recibe filas y devuelve diccionarios, asi que se
puede testear sin credenciales.
"""

import sys

from optimizar_compra import optimizar_compra, sucursales_en_radio

# Radio y cantidad de sucursales que la API acepta. El radio tiene tope porque
# el optimizador enumera combinaciones: con un radio grande en el AMBA entrarian
# cientos de sucursales y la busqueda dejaria de ser instantanea.
RADIO_MAXIMO_KM = 10.0
MAXIMO_SUCURSALES = 3


def clave_de(categoria: str, gama: str, unidad: str) -> str:
    """Identifica lo que se compra. Se internan las cadenas porque la misma
    combinacion se repite en cada una de las ~1.400 sucursales: internadas, el
    indice guarda un puntero por entrada y no una copia del texto."""
    return sys.intern(f"{categoria}|{gama}|{unidad}")


def armar_indice(filas) -> dict:
    """Agrupa las filas del mart (una por categoria x gama x unidad x sucursal)
    en una lista de sucursales con sus precios."""
    sucursales: dict = {}
    fecha = None
    for fila in filas:
        clave_sucursal = (fila["id_comercio"], fila["id_sucursal"])
        sucursal = sucursales.get(clave_sucursal)
        if sucursal is None:
            direccion = " ".join(str(x) for x in (fila.get("calle"), fila.get("numero")) if x).strip()
            sucursal = sucursales[clave_sucursal] = {
                "id": f"{fila['id_comercio']}-{fila['id_sucursal']}",
                "cadena": fila["cadena"],
                "nombre_sucursal": fila["nombre_sucursal"],
                "direccion": direccion or None,
                "localidad": fila["localidad"],
                "provincia": fila["provincia"],
                "latitud": fila["latitud"],
                "longitud": fila["longitud"],
                "precios": {},
            }
        sucursal["precios"][clave_de(fila["categoria"], fila["gama"], fila["unidad_normalizada"])] = (
            fila["precio_mediano_unidad"]
        )
        fecha = fecha or str(fila["fecha_datos"])
    return {"sucursales": list(sucursales.values()), "fecha_datos": fecha}


def _descomponer(clave: str) -> dict:
    categoria, gama, unidad = clave.split("|")
    return {"categoria": categoria, "gama": gama, "unidad": unidad}


def optimizar(indice: dict, items: list, latitud: float, longitud: float, radio_km: float,
              max_sucursales: int = MAXIMO_SUCURSALES) -> dict:
    """Resuelve la compra en 1, 2 y 3 sucursales dentro del radio.

    items: lista de {"categoria", "gama", "unidad", "cantidad"}, como los de Tu
    canasta. Devuelve lo mismo que optimizar_compra, pero con las claves y los
    ids traducidos a algo que la pantalla pueda mostrar.
    """
    radio_km = min(max(float(radio_km), 0.1), RADIO_MAXIMO_KM)
    max_sucursales = min(max(int(max_sucursales), 1), MAXIMO_SUCURSALES)

    cercanas = sucursales_en_radio(indice["sucursales"], latitud, longitud, radio_km)
    pedidos = [
        {"clave": clave_de(i["categoria"], i["gama"], i["unidad"]), "cantidad": i["cantidad"]}
        for i in items
    ]
    crudo = optimizar_compra(pedidos, cercanas, max_sucursales)

    por_id = {s["id"]: s for s in cercanas}
    datos_visibles = ("id", "cadena", "nombre_sucursal", "direccion", "localidad", "provincia",
                      "latitud", "longitud")

    opciones = []
    for opcion in crudo["opciones"]:
        sucursales = []
        for elegida in opcion["sucursales"]:
            sucursal = por_id[elegida["id"]]
            sucursales.append({
                **{campo: sucursal[campo] for campo in datos_visibles},
                "distancia_km": round(elegida["distancia_km"], 2),
                # Cuantas sucursales de la zona tienen exactamente los mismos
                # precios: sin esto, "la mas barata" parece unica cuando en
                # realidad hay varias iguales y se eligio la mas cercana.
                "equivalentes": elegida["equivalentes"],
                "subtotal": round(elegida["subtotal"], 2),
                "items": [
                    {
                        **_descomponer(item["clave"]),
                        "cantidad": item["cantidad"],
                        "precio_unitario": item["precio_unitario"],
                        "costo": round(item["costo"], 2),
                    }
                    for item in elegida["items"]
                ],
            })
        opciones.append({
            "max_sucursales": opcion["max_sucursales"],
            "total": round(opcion["total"], 2),
            "items_cubiertos": opcion["items_cubiertos"],
            "distancia_suma_km": round(opcion["distancia_suma_km"], 2),
            "sucursales": sucursales,
        })

    return {
        "fecha_datos": indice["fecha_datos"],
        "radio_km": radio_km,
        "sucursales_en_zona": crudo["sucursales_en_zona"],
        "sucursales_candidatas": crudo["sucursales_candidatas"],
        "items_sin_precio": [_descomponer(c) for c in crudo["items_sin_precio"]],
        "opciones": opciones,
    }
