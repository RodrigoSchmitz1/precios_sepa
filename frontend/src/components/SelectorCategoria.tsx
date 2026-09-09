/*
  Selector de categoria. Nacio compartido con la pagina de inflacion, que desde
  que abre con el ranking del mercado ya no lo necesita; queda como el <select>
  con estilo propio de la aplicacion.
*/
type Props = {
  categorias: string[];
  elegida: string;
  onElegir: (categoria: string) => void;
  etiqueta?: string;
};

function SelectorCategoria({ categorias, elegida, onElegir, etiqueta = "Categoria" }: Props) {
  return (
    <label className="inline-flex items-center gap-2.5">
      <span className="text-xs font-semibold uppercase tracking-wider text-tinta-suave">
        {etiqueta}
      </span>
      <select
        value={elegida}
        onChange={(e) => onElegir(e.target.value)}
        disabled={categorias.length === 0}
        className="bg-papel border border-linea rounded-xl px-3 py-2 text-sm text-tinta focus:outline-none focus:border-ahorro disabled:text-tinta-suave"
      >
        {categorias.length === 0 && <option value="">Cargando…</option>}
        {categorias.map((categoria) => (
          <option key={categoria} value={categoria}>
            {categoria}
          </option>
        ))}
      </select>
    </label>
  );
}

export default SelectorCategoria;
