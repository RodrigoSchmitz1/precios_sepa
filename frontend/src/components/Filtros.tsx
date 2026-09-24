import { useId, useMemo, useState } from "react";
import type { LugarMapa } from "../types";
import { PROVINCIAS, nombreProvincia } from "../utils/provincias";
import { normalizar } from "../utils/texto";

const SUGERENCIAS = 8;

type Props = {
  lugares: LugarMapa[];
  onElegirLugar: (lugar: LugarMapa) => void;
  provincia: string;
  onProvinciaChange: (valor: string) => void;
};

/*
  Ordena las sugerencias: primero los nombres que empiezan con lo tipeado,
  despues los que tienen una palabra que empieza asi ("plata" encuentra "Mar del
  Plata") y por ultimo los que lo contienen en cualquier lado. Dentro de cada
  grupo va primero el que mas sucursales tiene: quien escribe "san" casi seguro
  busca San Isidro y no un barrio con una sola sucursal.
*/
function sugerir(lugares: LugarMapa[], texto: string): LugarMapa[] {
  const buscado = normalizar(texto.trim());
  if (buscado.length < 2) return [];
  const puntuados: { lugar: LugarMapa; puesto: number }[] = [];
  for (const lugar of lugares) {
    const nombre = normalizar(lugar.nombre);
    let puesto = -1;
    if (nombre.startsWith(buscado)) puesto = 0;
    else if (nombre.split(/[\s-]+/).some((palabra) => palabra.startsWith(buscado))) puesto = 1;
    else if (nombre.includes(buscado)) puesto = 2;
    if (puesto >= 0) puntuados.push({ lugar, puesto });
  }
  // La API ya los manda de mas a menos sucursales, y sort es estable.
  puntuados.sort((a, b) => a.puesto - b.puesto);
  return puntuados.slice(0, SUGERENCIAS).map((p) => p.lugar);
}

/*
  Arriba del mapa: a donde mirar. El desplegable solo permitia elegir provincia;
  con el buscador se escribe la localidad o el barrio y el mapa vuela ahi.
*/
function Filtros({ lugares, onElegirLugar, provincia, onProvinciaChange }: Props) {
  const [texto, setTexto] = useState("");
  const [abierto, setAbierto] = useState(false);
  const [activo, setActivo] = useState(0);
  const idLista = useId();

  const sugerencias = useMemo(() => sugerir(lugares, texto), [lugares, texto]);
  const visible = abierto && sugerencias.length > 0;

  function elegir(lugar: LugarMapa) {
    setTexto(lugar.nombre);
    setAbierto(false);
    onElegirLugar(lugar);
  }

  function alTeclear(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown" && sugerencias.length > 0) {
      e.preventDefault();
      // Con la lista cerrada, la primera flecha solo la abre: avanzar ademas
      // salteaba la primera sugerencia.
      if (!abierto) {
        setAbierto(true);
        setActivo(0);
      } else {
        setActivo((activo + 1) % sugerencias.length);
      }
    } else if (e.key === "ArrowUp" && sugerencias.length > 0) {
      e.preventDefault();
      setActivo((activo - 1 + sugerencias.length) % sugerencias.length);
    } else if (e.key === "Enter" && visible) {
      e.preventDefault();
      elegir(sugerencias[activo]);
    } else if (e.key === "Escape") {
      setAbierto(false);
    }
  }

  return (
    <div className="flex flex-col sm:flex-row gap-2.5">
      <div className="relative flex-1">
        <span className="absolute left-0 top-1/2 -translate-y-1/2 text-tinta-suave text-sm" aria-hidden="true">
          ⌕
        </span>
        <input
          type="search"
          role="combobox"
          aria-expanded={visible}
          aria-controls={idLista}
          aria-autocomplete="list"
          aria-activedescendant={visible ? `${idLista}-${activo}` : undefined}
          aria-label="Ir a una localidad o barrio"
          placeholder="Ir a tu localidad o barrio (ej: Palermo, Rosario, Mar del Plata)"
          value={texto}
          onChange={(e) => {
            setTexto(e.target.value);
            setActivo(0);
            setAbierto(true);
          }}
          onFocus={() => setAbierto(true)}
          onBlur={() => setAbierto(false)}
          onKeyDown={alTeclear}
          autoComplete="off"
          className="w-full bg-transparent border-b border-linea-fuerte pl-6 pr-3 py-2.5 text-sm placeholder:text-tinta-suave focus:outline-none focus:border-ahorro"
        />
        {visible && (
          // Por encima del mapa: los paneles y controles de Leaflet llegan a z-index 1000.
          <ul
            id={idLista}
            role="listbox"
            className="absolute z-[1100] left-0 right-0 mt-1 bg-papel border border-linea rounded-lg shadow-lg overflow-hidden"
          >
            {sugerencias.map((lugar, i) => (
              <li
                key={`${lugar.nombre}-${lugar.provincia}-${i}`}
                id={`${idLista}-${i}`}
                role="option"
                aria-selected={i === activo}
                // mousedown y no click: el click llega despues del blur, que ya cerro la lista.
                onMouseDown={(e) => {
                  e.preventDefault();
                  elegir(lugar);
                }}
                onMouseEnter={() => setActivo(i)}
                className={`px-3 py-2 text-sm cursor-pointer flex items-baseline justify-between gap-3 ${
                  i === activo ? "bg-papel-hundido" : ""
                }`}
              >
                <span className="text-tinta min-w-0 truncate">
                  {lugar.nombre}
                  {lugar.provincia && <span className="text-tinta-suave">, {nombreProvincia(lugar.provincia)}</span>}
                </span>
                <span className="numero text-xs text-tinta-suave shrink-0">
                  {lugar.sucursales} {lugar.sucursales === 1 ? "sucursal" : "sucursales"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/*
        La lista sale de utils/provincias: antes estaban escritas a mano siete
        provincias y las demas quedaban inalcanzables desde el filtro.
      */}
      <select
        value={provincia}
        onChange={(e) => onProvinciaChange(e.target.value)}
        aria-label="Filtrar por provincia"
        className="bg-transparent border-b border-linea-fuerte px-0 py-2.5 text-sm text-tinta-media focus:outline-none focus:border-ahorro"
      >
        <option value="">Todas las provincias</option>
        {PROVINCIAS.map((p) => (
          <option key={p.codigo} value={p.codigo}>
            {p.nombre}
          </option>
        ))}
      </select>
    </div>
  );
}

export default Filtros;
