import { createBrowserRouter } from "react-router";
import Layout from "./components/Layout";
import PromosPage from "./pages/PromosPage";
import QuienGanaPage from "./pages/QuienGanaPage";
import CanastaPage from "./pages/CanastaPage";
import InflacionPage from "./pages/InflacionPage";

const router = createBrowserRouter([
  {
    path: "/",
    element: <Layout />,
    children: [
      { index: true, element: <PromosPage /> },
      { path: "canasta", element: <CanastaPage /> },
      { path: "quien-gana", element: <QuienGanaPage /> },
      { path: "inflacion", element: <InflacionPage /> },
    ],
  },
]);

export default router;
