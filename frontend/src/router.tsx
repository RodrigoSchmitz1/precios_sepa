import { createBrowserRouter } from "react-router";
import Layout from "./components/Layout";
import PromosPage from "./pages/PromosPage";
import ProximamentePage from "./pages/ProximamentePage";

const router = createBrowserRouter([
  {
    path: "/",
    element: <Layout />,
    children: [
      { index: true, element: <PromosPage /> },
      { path: "canasta", element: <ProximamentePage titulo="Canasta basica" /> },
      { path: "quien-gana", element: <ProximamentePage titulo="Quien gana" /> },
      { path: "inflacion", element: <ProximamentePage titulo="Inflacion" /> },
    ],
  },
]);

export default router;
