import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Eliminación de datos | Recepia",
  description: "Instrucciones para solicitar la eliminación de datos asociados a Recepia.",
};

export default function DataDeletionPage() {
  return (
    <div className="space-y-8 leading-7">
      <div>
        <p className="text-sm font-medium text-emerald-700">RELOS VM, S.L. · Recepia</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-stone-950">
          Solicitud de eliminación de datos
        </h1>
        <p className="mt-4 text-stone-600">
          Puedes solicitar la eliminación de los datos personales asociados a tu uso de Recepia o a
          una conexión iniciada con Facebook o WhatsApp.
        </p>
      </div>

      <section>
        <h2 className="text-xl font-semibold text-stone-950">Cómo solicitarla</h2>
        <ol className="mt-3 list-decimal space-y-3 pl-6">
          <li>
            Envía un correo a{" "}
            <a className="text-emerald-700 underline" href="mailto:marc@iatope.com">
              marc@iatope.com
            </a>{" "}
            con el asunto <strong>“Supresión de datos Recepia”</strong>.
          </li>
          <li>
            Indica el nombre y el correo o teléfono utilizado, la clínica relacionada y, si procede,
            que la solicitud corresponde a una conexión de Facebook o WhatsApp.
          </li>
          <li>
            No envíes contraseñas, códigos de verificación ni documentación sensible salvo que te la
            solicitemos expresamente para verificar tu identidad.
          </li>
        </ol>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-stone-950">Qué ocurre después</h2>
        <p className="mt-3">
          Confirmaremos la recepción y atenderemos la solicitud dentro del plazo legal aplicable,
          normalmente un mes. Eliminaremos o anonimizaremos los datos que correspondan, salvo
          aquellos que debamos conservar por una obligación legal o para la defensa de reclamaciones.
        </p>
        <p className="mt-3">
          Si Recepia trata los datos por cuenta de una clínica veterinaria, coordinaremos la solicitud
          con esa clínica, que es la responsable de la ficha del cliente y de la mascota.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-stone-950">Retirar la conexión de Facebook</h2>
        <p className="mt-3">
          También puedes retirar el acceso desde Facebook en <strong>Configuración y privacidad →
          Configuración → Aplicaciones y sitios web</strong>, seleccionando Recepia y pulsando
          eliminar. Retirar la aplicación impide accesos futuros, pero no sustituye una solicitud de
          supresión de datos ya almacenados; para eso utiliza el correo indicado arriba.
        </p>
      </section>
    </div>
  );
}
