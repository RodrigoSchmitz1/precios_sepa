# Tasks

## 1. API: las cadenas cercanas

- [x] 1.1 `RADIO_CERCA_KM = 3` en `api/mapa_promos.py`, usado por las promos y por las zonas (`RADIO_PROMOS_KM` como alias)
- [x] 1.2 `lugares(con_cadenas=True)`
  - cadenas del lugar más las de sucursales a menos de 3 km del centro, con filtro por latitud
  - `otra_cadena_cerca: {cadena, km}` si queda una sola
- [x] 1.3 `/zonas` calculado una vez por índice del mapa, con el tiempo medido antes y después
- [x] 1.4 Tests
  - barrio con una cadena adentro y otras a 2 km
  - ciudad sin otra cadena cerca, con `otra_cadena_cerca`
  - sucursal a 3,5 km que no entra
  - las promos siguen con el mismo radio

## 2. Frontend

- [x] 2.1 `utils/cifrasPortada.ts`
  - tarjeta de una sola cadena con la distancia a la otra más cercana
  - canasta con lo que costaría en la más barata del país, si hay total nacional
  - tests: Rafaela, Cooperativa Obrera sin total, sin `otra_cadena_cerca`
- [x] 2.2 `Presentacion.tsx` pasa lo necesario a `cifrasDePortada`; tipo `Zona` con `otra_cadena_cerca` opcional
- [x] 2.3 `SelectorZona.tsx` dice "N cadenas cerca"; `QuienGanaPage.tsx` dice "Cerca de tu zona…"
- [x] 2.4 Lint, `tsc -b`, `vitest` y `build`

## 3. Verificación y docs

- [x] 3.1 Medir con la API local: zonas por cantidad de cadenas antes y después, y ejemplos (Villa Soldati, Lomas, Rafaela, Esquel)
- [x] 3.2 E2E en WebKit a 414 px
  - Villa Soldati: la portada sin "única cadena", Más barato con ranking de la zona
  - Rafaela: la distancia y la comparación con la más barata del país
  - una zona de la Cooperativa Obrera, sin la cifra
  - sin desborde
- [x] 3.3 `docs/DECISIONES.md`: sección "Las cadenas cerca de tu zona" con lo medido. README si cambian los conteos
- [x] 3.4 `openspec validate cadenas-cerca-de-tu-zona --strict`
