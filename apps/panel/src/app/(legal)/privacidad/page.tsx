import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Política de privacidad | Recepia",
  description: "Información sobre el tratamiento de datos personales en Recepia.",
};

export default function PrivacyPage() {
  return (
    <div className="space-y-8 leading-7">
      <div>
        <p className="text-sm font-medium text-emerald-700">Última actualización: 30 de agosto de 2026</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-stone-950">
          Política de privacidad
        </h1>
      </div>

      <section>
        <h2 className="text-xl font-semibold text-stone-950">1. Responsable del tratamiento</h2>
        <p className="mt-3">
          RELOS VM, S.L., con NIF B44849263 y domicilio en Calle de la Guineu, 10, 43008
          Tarragona, España, es responsable de los datos tratados directamente a través del sitio
          y del servicio Recepia. Puedes contactar en materia de privacidad mediante{" "}
          <a className="text-emerald-700 underline" href="mailto:marc@iatope.com">
            marc@iatope.com
          </a>
          .
        </p>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-stone-950">2. Papel de Recepia</h2>
        <p className="mt-3">
          Recepia presta servicios de recepción virtual a clínicas veterinarias. Cuando una persona
          interactúa con Recepia por WhatsApp, teléfono, chat u otro canal en nombre de una clínica,
          la clínica es la responsable del tratamiento y RELOS VM, S.L. actúa como encargado del
          tratamiento conforme a sus instrucciones y al contrato suscrito con ella.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-stone-950">3. Datos tratados</h2>
        <ul className="mt-3 list-disc space-y-2 pl-6">
          <li>Datos identificativos y de contacto de usuarios, clientes y personal de las clínicas.</li>
          <li>Información sobre mascotas, citas y solicitudes de atención veterinaria.</li>
          <li>Mensajes, archivos, metadatos de entrega y, cuando se informe previamente, audio.</li>
          <li>Datos técnicos y de seguridad necesarios para mantener el servicio y prevenir abusos.</li>
          <li>Datos profesionales facilitados por clínicas interesadas en contratar Recepia.</li>
        </ul>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-stone-950">4. Finalidades y bases jurídicas</h2>
        <ul className="mt-3 list-disc space-y-2 pl-6">
          <li>Prestar el servicio contratado y gestionar las cuentas de usuario.</li>
          <li>Atender conversaciones, organizar citas y transferir solicitudes al equipo humano.</li>
          <li>Mantener la seguridad, trazabilidad y calidad del servicio.</li>
          <li>Atender consultas comerciales y cumplir obligaciones legales.</li>
        </ul>
        <p className="mt-3">
          Las bases jurídicas aplicables son la ejecución del contrato, el cumplimiento de
          obligaciones legales, el interés legítimo en proteger y mejorar el servicio y, cuando
          corresponda, el consentimiento. En los tratamientos realizados por cuenta de una clínica,
          la base jurídica la determina dicha clínica.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-stone-950">5. Proveedores y transferencias</h2>
        <p className="mt-3">
          Para operar Recepia podemos utilizar proveedores de alojamiento, bases de datos,
          inteligencia artificial, mensajería, telefonía, correo y calendarios. Entre ellos pueden
          encontrarse Supabase, Vercel, Meta Platforms, Google, Anthropic, OpenAI, Twilio y Vapi,
          según las funciones activadas por cada clínica. Estos proveedores actúan bajo contrato y
          solo acceden a los datos necesarios para prestar su servicio.
        </p>
        <p className="mt-3">
          Cuando existe una transferencia fuera del Espacio Económico Europeo, se aplican las
          garantías previstas por la normativa, como decisiones de adecuación o cláusulas
          contractuales tipo.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-stone-950">6. Conservación</h2>
        <p className="mt-3">
          Los datos se conservan durante el tiempo necesario para prestar el servicio y cumplir las
          obligaciones legales. Como configuración de referencia, los mensajes se conservan hasta
          365 días, las grabaciones hasta 90 días y los resúmenes hasta 730 días, salvo que la clínica
          establezca otro plazo o solicite su supresión. Los datos comerciales se conservan hasta dos
          años desde el último contacto.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-stone-950">7. Derechos</h2>
        <p className="mt-3">
          Puedes solicitar acceso, rectificación, supresión, oposición, limitación y portabilidad, y
          retirar tu consentimiento cuando sea aplicable, escribiendo a{" "}
          <a className="text-emerald-700 underline" href="mailto:marc@iatope.com">
            marc@iatope.com
          </a>
          . Si tus datos pertenecen a la ficha de una clínica, también puedes dirigirte directamente
          a ella. Tienes derecho a reclamar ante la Agencia Española de Protección de Datos en{" "}
          <a className="text-emerald-700 underline" href="https://www.aepd.es" rel="noreferrer">
            aepd.es
          </a>
          .
        </p>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-stone-950">8. Inteligencia artificial</h2>
        <p className="mt-3">
          Recepia informa de que es un asistente de inteligencia artificial y permite solicitar en
          cualquier momento la intervención de una persona. No realiza diagnósticos veterinarios ni
          adopta decisiones automatizadas con efectos jurídicos. Las alertas de urgencia son apoyo
          operativo y deben ser revisadas por profesionales.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-stone-950">9. Seguridad y cambios</h2>
        <p className="mt-3">
          Aplicamos cifrado, controles de acceso, registros de auditoría y otras medidas razonables
          para proteger la información. Esta política puede actualizarse para reflejar cambios
          legales o técnicos; la versión vigente se publicará siempre en esta página.
        </p>
      </section>
    </div>
  );
}
