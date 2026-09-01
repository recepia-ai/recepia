import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Condiciones del servicio | Recepia",
  description: "Condiciones de uso del servicio profesional Recepia.",
};

export default function TermsPage() {
  return (
    <div className="space-y-8 leading-7">
      <div>
        <p className="text-sm font-medium text-emerald-700">Última actualización: 30 de agosto de 2026</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-stone-950">
          Condiciones del servicio
        </h1>
      </div>

      <section>
        <h2 className="text-xl font-semibold text-stone-950">1. Titular y objeto</h2>
        <p className="mt-3">
          Recepia es un servicio de RELOS VM, S.L., NIF B44849263, con domicilio en Calle de la
          Guineu, 10, 43008 Tarragona, España. Estas condiciones regulan el acceso al panel y a las
          funciones de recepción virtual ofrecidas a clínicas y profesionales veterinarios.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-stone-950">2. Uso profesional</h2>
        <p className="mt-3">
          El servicio está dirigido a empresas y profesionales autorizados. Cada organización es
          responsable de sus usuarios, de mantener sus credenciales seguras y de facilitar datos
          completos y veraces durante el alta y la verificación de integraciones.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-stone-950">3. Alcance del asistente</h2>
        <p className="mt-3">
          Recepia ayuda a gestionar consultas, identificar clientes, organizar citas y transferir
          conversaciones. No sustituye al criterio de un veterinario, no emite diagnósticos y no debe
          utilizarse como único canal para emergencias. La clínica debe mantener procedimientos de
          supervisión y atención humana.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-stone-950">4. Integraciones de terceros</h2>
        <p className="mt-3">
          Algunas funciones dependen de servicios de terceros, como WhatsApp, Google Calendar,
          plataformas de telefonía o software de gestión veterinaria. Su uso está sujeto además a
          las condiciones de esos proveedores. La clínica debe disponer de las autorizaciones y
          derechos necesarios sobre las cuentas y números que conecte.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-stone-950">5. Uso permitido</h2>
        <p className="mt-3">No se permite utilizar Recepia para:</p>
        <ul className="mt-3 list-disc space-y-2 pl-6">
          <li>Enviar spam, comunicaciones ilícitas o contenido fraudulento.</li>
          <li>Acceder a datos o cuentas sin autorización.</li>
          <li>Eludir controles de seguridad o interferir con el funcionamiento del servicio.</li>
          <li>Tratar categorías de datos no acordadas o incumplir la normativa aplicable.</li>
        </ul>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-stone-950">6. Disponibilidad y cambios</h2>
        <p className="mt-3">
          Trabajamos para mantener el servicio disponible y seguro, pero pueden producirse tareas de
          mantenimiento, incidencias o cambios de terceros. Podemos modificar funciones para mejorar
          el servicio, cumplir la ley o responder a cambios técnicos, informando cuando el impacto
          sea relevante.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-stone-950">7. Propiedad intelectual</h2>
        <p className="mt-3">
          Recepia, su software, diseño y documentación pertenecen a RELOS VM, S.L. o a sus
          licenciantes. La contratación concede únicamente un derecho de uso limitado durante la
          vigencia del servicio. Cada clínica conserva la titularidad y responsabilidad sobre sus
          propios datos y contenidos.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-stone-950">8. Responsabilidad</h2>
        <p className="mt-3">
          Recepia es una herramienta de apoyo administrativo. La clínica es responsable de revisar
          la información relevante, atender urgencias y adoptar decisiones clínicas. La
          responsabilidad de las partes se regirá por el contrato profesional aplicable y por la
          legislación imperativa.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-stone-950">9. Legislación y contacto</h2>
        <p className="mt-3">
          Estas condiciones se rigen por la legislación española. Para cualquier consulta escribe a{" "}
          <a className="text-emerald-700 underline" href="mailto:marc@iatope.com">
            marc@iatope.com
          </a>
          . Cuando la ley lo permita, las partes se someten a los juzgados y tribunales de Tarragona.
        </p>
      </section>
    </div>
  );
}
