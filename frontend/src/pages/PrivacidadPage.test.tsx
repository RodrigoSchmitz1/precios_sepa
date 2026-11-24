// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router";
import { expect, it } from "vitest";
import PrivacidadPage from "./PrivacidadPage";

/* Privacidad (openspec pagina-de-privacidad). */

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

it("dice quién es el responsable, el contacto, adónde van las fotos y la leyenda de la AAIP", () => {
  const contenedor = document.createElement("div");
  const raiz = createRoot(contenedor);
  act(() => raiz.render(<MemoryRouter><PrivacidadPage /></MemoryRouter>));
  const t = contenedor.textContent ?? "";
  expect(t).toContain("Rodrigo Schmitz");
  expect(contenedor.querySelector('a[href="mailto:rodri.schmitz@gmail.com"]')).toBeTruthy();
  expect(t).toContain("Google Gemini");
  expect(t).toContain("Estados Unidos");
  expect(t).toContain("30 días");
  expect(t).toContain("Órgano de Control de la Ley N° 25.326");
  expect(t).toContain("todavía no está activa");
  act(() => raiz.unmount());
});
