import { createBrowserRouter } from "react-router";
import Layout from "./components/Layout";
import PromosPage from "./pages/PromosPage";
import QuienGanaPage from "./pages/QuienGanaPage";
import CanastaPage from "./pages/CanastaPage";
import CanastaPersonalizadaPage from "./pages/CanastaPersonalizadaPage";
import InflacionPage from "./pages/InflacionPage";
import MismoProductoPage from "./pages/MismoProductoPage";

const router = createBrowserRouter([
  {
    path: "/",
    element: <Layout />,
    children: [
      { index: true, element: <PromosPage /> },
      { path: "canasta", element: <CanastaPage /> },
      { path: "canasta-personalizada", element: <CanastaPersonalizadaPage /> },
      { path: "quien-gana", element: <QuienGanaPage /> },
      { path: "mismo-producto", element: <MismoProductoPage /> },
      { path: "inflacion", element: <InflacionPage /> },
    ],
  },
]);

export default router;
