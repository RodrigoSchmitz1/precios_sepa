import { createBrowserRouter } from "react-router";
import AMiCompra from "./components/AMiCompra";
import Layout from "./components/Layout";
import PromosPage from "./pages/PromosPage";
import PromosRubroPage from "./pages/PromosRubroPage";
import QuienGanaPage from "./pages/QuienGanaPage";
import InflacionPage from "./pages/InflacionPage";
import MismoProductoPage from "./pages/MismoProductoPage";
import ListaPage from "./pages/ListaPage";
import GastosPage from "./pages/GastosPage";
import ComoSeCalculaPage from "./pages/ComoSeCalculaPage";
import NoEncontradaPage from "./pages/NoEncontradaPage";

const router = createBrowserRouter([
  {
    path: "/",
    element: <Layout />,
    children: [
      { index: true, element: <PromosPage /> },
      // La canasta basica se retiro el 2026-10-08 (ver Presentacion.tsx). Los
      // links viejos llevan a Mi compra, que arranca desde la misma canasta del INDEC.
      { path: "canasta", element: <AMiCompra /> },
      // Tu canasta se unio con Mi lista en Mi compra (openspec mi-compra).
      { path: "canasta-personalizada", element: <AMiCompra /> },
      // Las promos de una categoria (openspec promos-navegables-y-mes-en-gastos).
      { path: "promos/:rubro", element: <PromosRubroPage /> },
      { path: "quien-gana", element: <QuienGanaPage /> },
      { path: "mismo-producto", element: <MismoProductoPage /> },
      { path: "lista", element: <ListaPage /> },
      { path: "gastos", element: <GastosPage /> },
      { path: "inflacion", element: <InflacionPage /> },
      { path: "como-se-calcula", element: <ComoSeCalculaPage /> },
      // Cualquier otra direccion: una pagina propia con el menu, no el error de React Router.
      { path: "*", element: <NoEncontradaPage /> },
    ],
  },
]);

export default router;
