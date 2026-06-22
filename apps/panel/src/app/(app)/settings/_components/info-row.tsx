export function InfoRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between py-2.5 text-sm">
      <span className="text-stone-500">{label}</span>
      <span className="font-medium text-stone-900">{value}</span>
    </div>
  );
}

export function InfoSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-stone-200 bg-white p-5 shadow-card">
      <h3 className="mb-0.5 text-sm font-semibold text-stone-900">{title}</h3>
      <div className="divide-y divide-stone-100">{children}</div>
    </div>
  );
}
