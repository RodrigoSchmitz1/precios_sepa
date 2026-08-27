import { createBrowserRouter } from "react-router";
import Layout from "./components/Layout";
import PromosPage from "./pages/PromosPage";
import QuienGanaPage from "./pages/QuienGanaPage";
import ProximamentePage from "./pages/ProximamentePage";

const router = createBrowserRouter([
  {
    path: "/",
    element: <Layout />,
    children: [
      { index: true, element: <PromosPage /> },
      { path: "canasta", element: <ProximamentePage titulo="Canasta basica" /> },
      { path: "quien-gana", element: <QuienGanaPage /> },
      { path: "inflacion", element: <ProximamentePage titulo="Inflacion" /> },
    ],
  },
]);

export default router;
