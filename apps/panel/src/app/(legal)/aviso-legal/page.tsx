import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Aviso legal | Recepia",
  description: "Información legal del sitio y servicio Recepia.",
};

export default function LegalNoticePage() {
  return (
    <div className="space-y-8 leading-7">
      <div>
        <p className="text-sm font-medium text-emerald-700">Información del titular</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-stone-950">Aviso legal</h1>
      </div>

      <section>
        <h2 className="text-xl font-semibold text-stone-950">Titular del sitio</h2>
        <dl className="mt-3 grid gap-2 sm:grid-cols-[10rem_1fr]">
          <dt className="font-medium">Razón social</dt>
          <dd>RELOS VM, S.L.</dd>
          <dt className="font-medium">NIF</dt>
          <dd>B44849263</dd>
          <dt className="font-medium">Domicilio</dt>
          <dd>Calle de la Guineu, 10, 43008 Tarragona, España</dd>
          <dt className="font-medium">Contacto</dt>
          <dd>
            <a className="text-emerald-700 underline" href="mailto:marc@iatope.com">
              marc@iatope.com
            </a>
          </dd>
          <dt className="font-medium">Registro Mercantil</dt>
          <dd>Tarragona, tomo 3363, folio 152, hoja T-60185</dd>
        </dl>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-stone-950">Uso del sitio</h2>
        <p className="mt-3">
          El acceso al sitio implica un uso lícito y respetuoso con estas condiciones, la legislación
          aplicable y los derechos de terceros. Los contenidos se ofrecen con fines informativos y
          profesionales. Los nombres, marcas, software y materiales de Recepia están protegidos por
          la normativa de propiedad intelectual e industrial.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-stone-950">Enlaces y disponibilidad</h2>
        <p className="mt-3">
          El sitio puede incluir enlaces o integraciones de terceros sobre los que no ejercemos
          control editorial. Adoptamos medidas razonables para mantener la información y el servicio
          disponibles y seguros, sin garantizar la ausencia absoluta de interrupciones o errores.
        </p>
      </section>
    </div>
  );
}
