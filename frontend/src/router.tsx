import { createBrowserRouter, Navigate } from "react-router";
import Layout from "./components/Layout";
import PromosPage from "./pages/PromosPage";
import QuienGanaPage from "./pages/QuienGanaPage";
import CanastaPersonalizadaPage from "./pages/CanastaPersonalizadaPage";
import InflacionPage from "./pages/InflacionPage";
import MismoProductoPage from "./pages/MismoProductoPage";
import ComoSeCalculaPage from "./pages/ComoSeCalculaPage";

const router = createBrowserRouter([
  {
    path: "/",
    element: <Layout />,
    children: [
      { index: true, element: <PromosPage /> },
      // La canasta basica se retiro el 2026-10-08 (ver Presentacion.tsx). Los
      // links viejos llevan a Tu canasta, que parte de la misma canasta del INDEC.
      { path: "canasta", element: <Navigate to="/canasta-personalizada" replace /> },
      { path: "canasta-personalizada", element: <CanastaPersonalizadaPage /> },
      { path: "quien-gana", element: <QuienGanaPage /> },
      { path: "mismo-producto", element: <MismoProductoPage /> },
      { path: "inflacion", element: <InflacionPage /> },
      { path: "como-se-calcula", element: <ComoSeCalculaPage /> },
    ],
  },
]);

export default router;
