import { lazy } from "react";

/*
  Lo que esta en el menu Mas se descarga recien al abrirlo (openspec
  app-para-el-usuario): la primera carga no paga por secciones que la mayoria
  no abre. El Suspense que muestra la espera esta en el Layout. Viven en un
  archivo aparte porque router.tsx exporta el router, no componentes.
*/
export const QuienGanaPage = lazy(() => import("./QuienGanaPage"));
export const InflacionPage = lazy(() => import("./InflacionPage"));
export const ComoSeCalculaPage = lazy(() => import("./ComoSeCalculaPage"));
export const PrivacidadPage = lazy(() => import("./PrivacidadPage"));
