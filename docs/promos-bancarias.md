# Cómo se curan las promos bancarias

Las promos de bancos y billeteras que muestra Changuito están en
`api/datos/promos_bancarias.json`, cargadas a mano (openspec `promos-bancarias`).
SEPA no las trae, y no hay un dataset oficial. Este documento dice cómo se
mantiene ese archivo.

## Fuentes

La fuente es la página de descuentos de cada súper. MODO sirve como control, para
encontrar lo que falta. **Nunca se usan los datos de Convi ni de otros
agregadores**: sus términos lo prohíben y además no hace falta.

| Cadena | Página | Notas |
|---|---|---|
| Carrefour (Hiper, Market, Express, Maxi) | https://www.carrefour.com.ar/descuentos-bancarios | Se arma con JavaScript. Arriba se elige el formato (`?formato=hyper`, `market`, `express`; por defecto muestra la compra online). Vistas por día y por banco, con vigencia, % y tope |
| Coto | https://www.coto.com.ar/descuentos | Se arma con JavaScript |
| Día | https://diaonline.supermercadosdia.com.ar/medios-de-pago-y-promociones | El % y el banco están en imágenes: hay que leerlas a ojo |
| Jumbo, Disco y Vea | https://www.jumbo.com.ar/descuentos-del-dia | El día va en la URL (`?type=por-dia&day=5` es el viernes). Filtros por día y por banco (vale para las tres) |
| ChangoMás | página de promos bancarias de ChangoMás / MasOnline | A relevar |
| La Anónima | página de promociones de La Anónima | A relevar |
| Cooperativa Obrera | página de beneficios de la Cooperativa | A relevar |
| MODO (control) | https://www.modo.com.ar/promos | Feed estructurado: sirve para cruzar, no como fuente única |

Todas estas páginas necesitan un navegador: leídas sin JavaScript vienen vacías
(comprobado el 27-11-2026).

## Cada cuánto

- **Principio de mes:** carga completa. La mayoría de las promos cambian con el mes.
- **Cada lunes:** repaso de cada página. Hay que sumar lo nuevo, corregir lo que cambió y cerrar lo que ya no está.
- La app muestra "revisada el …" en cada promo. Si la revisión más vieja tiene más de 10 días, toca revisar.

**Qué entra y qué no.** Entran los descuentos y reintegros de bancos y billeteras. No entran las cuotas sin interés (no son un ahorro), los clubes de diarios ni los programas propios de cada cadena (Mi Carrefour, ANSES y similares): pueden sumarse más adelante.

## Qué se anota

Una entrada por promo, con el esquema que valida `api/promos_bancarias.py`:

- `id`: único, por ejemplo `dia-modo-miercoles-2026-12`.
- `cadenas`: los nombres de SEPA, como `"Dia"`, `"Market (Carrefour)"` o `"Jumbo"`. Si la página dice "Carrefour" y vale en todas sus banderas, se listan todas.
- `entidad`: el banco o la billetera, como lo nombra la gente (`"MODO"`, `"Banco Nación"`, `"Mercado Pago"`).
- `medio`: `credito`, `debito`, `qr`, `billetera` o `prepaga`.
- `segmento`: solo si la promo es para un grupo, por ejemplo `"jubilados"` o `"Plan Sueldo"`. Si no, `null`.
- `dias`: en minúscula y sin tilde, como `["miercoles"]`.
- `porcentaje`, `tipo` (`descuento` en caja o `reintegro`) y `canal` (`sucursal`, `online` o `ambos`).
- `tope` en pesos y `tope_periodo` (`compra`, `dia`, `semana` o `mes`). Sin tope, los dos en `null`.
- `compra_minima` en pesos, o `null`.
- `rubros`: solo si la promo vale para algunos rubros, por ejemplo `["Galletitas", "Gaseosas"]`. Si no, `null`.
- `acumula`: `si`, `no` o `no_se_sabe`, según si se suma a las promos de góndola. Ante la duda, `no_se_sabe`.
- `vigente_desde` y `vigente_hasta` (AAAA-MM-DD). Si la página no dice hasta cuándo, el último día del mes, y se vuelve a mirar el lunes.
- `fuente`: la URL exacta de la página de donde salió.
- `revisada`: el día en que se miró la página.
- `nota`: opcional, con palabras propias y pocas.

## Qué no se copia

- **Ningún texto legal**, ni entero ni en partes. Solo los hechos: %, días, topes, fechas.
- **Ninguna imagen** de las cadenas o de los bancos.
- **Nada de otros agregadores** (Convi, notas de medios). Los medios sirven solo para enterarse de que algo cambió; el dato se toma de la página de la cadena.

## Cuando una promo ya no aparece

Si en el repaso una promo cargada ya no figura en la página de la cadena, se
cierra: `vigente_hasta` pasa a ser ese día. No se borra enseguida, así queda en
el historial de git. Las vencidas de más de un mes se pueden borrar en la carga
de principio de mes.

## Antes de commitear

```
cd api
SIN_BIGQUERY=1 venv/Scripts/python.exe -m unittest test_promos_bancarias -v
```

El test `test_el_archivo_curado_es_valido` falla si falta un campo, si una cadena
está mal escrita, si el porcentaje está fuera de rango, si la vigencia está al
revés o si la fecha de revisión está en el futuro.

## Lo que viene

- Lectores automáticos de cada página, una vez por día, en otro change. Antes hay
  que leer los términos y el robots.txt de cada sitio y consultarlo legalmente.
- Cuánto tope te queda este mes, usando Mis gastos (con qué pagaste cada ticket).
