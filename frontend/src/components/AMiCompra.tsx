import { Navigate, useLocation } from "react-router";

/** Los links viejos de Tu canasta llevan a Mi compra, con su zona (openspec mi-compra). */
export default function AMiCompra() {
  const { search } = useLocation();
  return <Navigate to={`/lista${search}`} replace />;
}
