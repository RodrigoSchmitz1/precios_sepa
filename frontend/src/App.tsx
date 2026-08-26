import { useState, useEffect } from "react";

type Promo = {
  descripcion: string;
  marca: string;
  categoria: string | null;
  rubro: string | null;
  cadena: string;
  provincia: string;
  precio_lista: number;
  precio_promo: number;
  descuento_pct: number;
  leyenda: string;
  sucursales_con_esta_promo: number;
};

function App() {
  const [promos, setPromos] = useState<Promo[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("http://127.0.0.1:8000/promos?limite=20")
      .then((respuesta) => respuesta.json())
      .then((datos) => {
        setPromos(datos);
        setCargando(false);
      })
      .catch((err) => {
        setError(err.message);
        setCargando(false);
      });
  }, []);

  if (cargando) return <p>Cargando promos...</p>;
  if (error) return <p>Error al cargar: {error}</p>;

  return (
    <div>
      <h1>Promos vigentes</h1>
      <ul>
        {promos.map((promo, i) => (
          <li key={i}>
            {promo.descripcion} ({promo.marca}) — {promo.cadena} / {promo.provincia}
            <br />
            ${promo.precio_lista} ? ${promo.precio_promo} ({promo.descuento_pct}% off)
          </li>
        ))}
      </ul>
    </div>
  );
}

export default App;
