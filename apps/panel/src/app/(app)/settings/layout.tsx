import { SettingsTabs } from "./_components/settings-tabs";

export default async function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-stone-900">
          Ajustes
        </h1>
        <p className="mt-1 text-sm text-stone-500">
          Gestiona la clínica, los servicios, profesionales, horarios e integraciones.
        </p>
      </div>

      {/* Tabs */}
      <SettingsTabs />

      {/* Content */}
      <div>{children}</div>
    </div>
  );
}
