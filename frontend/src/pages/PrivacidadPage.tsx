import type { ReactNode } from "react";
import Titular from "../components/Titular";

/*
  Privacidad (openspec pagina-de-privacidad): la informacion que pide la Ley
  25.326 (art. 6) en palabras de quien usa la app. Tiene que decir la verdad
  sobre lo que hace el sitio: si cambia lo que se guarda o adonde va, cambia
  aca. Lo que esta apagado en el servicio (fotos de tickets, señales anonimas)
  se describe igual, aclarando que solo funciona cuando esta prendido.
*/

const RESPONSABLE = "Rodrigo Schmitz";
const CONTACTO = "rodri.schmitz@gmail.com";
const ACTUALIZADA = "24 de noviembre de 2026";

const SECCIONES: { titulo: string; parrafos: ReactNode[] }[] = [
  {
    titulo: "Quién es el responsable",
    parrafos: [
      <>
        Changuito lo hace {RESPONSABLE}. Para cualquier consulta sobre tus datos escribí a{" "}
        <a className="underline" href={`mailto:${CONTACTO}`}>
          {CONTACTO}
        </a>
        .
      </>,
    ],
  },
  {
    titulo: "Lo que queda solo en tu teléfono",
    parrafos: [
      "Changuito no tiene cuentas. Tu zona, Mi compra, Mis gastos, tus avisos de oferta y tu presupuesto se guardan en el navegador de tu teléfono y no se mandan a ningún servidor para guardarse.",
      "Para mostrarte precios y promos cerca, la app le pide a nuestro servidor los datos de tu zona (el centro del barrio o la localidad que elegiste, no tu ubicación exacta) o los productos de tu lista, y el servidor contesta sin guardarlos en ninguna base.",
      "Podés borrar todo esto cuando quieras: en Mis gastos con \"Borrar todos mis gastos\", o borrando los datos del sitio en tu navegador.",
    ],
  },
  {
    titulo: "Fotos de tickets",
    parrafos: [
      "Si sacás una foto de un ticket, se manda a leer a Google Gemini, en servidores de Estados Unidos, y no se guarda en ningún lado. De lo leído se descartan el DNI, la tarjeta, el nombre y el número de cliente; lo demás vuelve a tu teléfono y queda ahí. Antes de la primera foto te lo pedimos con \"Acepto y saco la foto\".",
      "La lectura de fotos todavía no está activa: por ahora podés anotar el monto a mano.",
    ],
  },
  {
    titulo: "Datos anónimos para estadísticas",
    parrafos: [
      "Cuando estén activos, Changuito va a contar de forma anónima qué categorías de promos se miran, qué se busca (solo la categoría, nunca lo que escribís) y qué productos se piden en los avisos, con la provincia y la localidad de tu zona. Cada teléfono usa un identificador al azar que cambia todos los días, así que no se puede saber qué hizo una misma persona de un día para otro. Sirve para armar estadísticas agrupadas para marcas y supermercados; un grupo de pocas personas no se muestra. Los vas a poder apagar en un toque desde el menú.",
    ],
  },
  {
    titulo: "Registros técnicos del servidor",
    parrafos: [
      "Como cualquier sitio, el servidor (Google Cloud) registra cada pedido con la dirección IP, la dirección pedida (que puede incluir las coordenadas del centro de tu zona) y el tipo de navegador. Esos registros sirven para que el sitio funcione y para detectar abusos, no se usan para otra cosa y se borran solos a los 30 días.",
    ],
  },
  {
    titulo: "Tus derechos",
    parrafos: [
      <>
        Podés pedir acceso, rectificación o supresión de tus datos escribiendo a{" "}
        <a className="underline" href={`mailto:${CONTACTO}`}>
          {CONTACTO}
        </a>
        . Como casi todo queda en tu teléfono, lo más rápido suele ser borrarlo desde la app.
      </>,
      "La AGENCIA DE ACCESO A LA INFORMACIÓN PÚBLICA, en su carácter de Órgano de Control de la Ley N° 25.326, tiene la atribución de atender las denuncias y reclamos que interpongan quienes resulten afectados en sus derechos por incumplimiento de las normas vigentes en materia de protección de datos personales.",
    ],
  },
];

function PrivacidadPage() {
  return (
    <div className="max-w-3xl mx-auto">
      <Titular antetitulo="Privacidad" compacto>
        Qué pasa con tus datos en Changuito
      </Titular>
      <p className="text-sm text-tinta-suave mb-6">Actualizada el {ACTUALIZADA}.</p>
      <div className="space-y-6">
        {SECCIONES.map((s) => (
          <section key={s.titulo} className="tarjeta p-5 sm:p-6">
            <h2 className="text-lg font-bold text-tinta mb-2">{s.titulo}</h2>
            <div className="space-y-2 text-base text-tinta-media leading-relaxed">
              {s.parrafos.map((p, i) => (
                <p key={i}>{p}</p>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

export default PrivacidadPage;
