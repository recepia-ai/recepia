import { Globe2, MessageCircle, Phone } from "lucide-react";

type Channel = "web" | "whatsapp" | "phone";

const CHANNEL_CONFIG = {
  web: {
    label: "Web",
    icon: Globe2,
    className: "bg-stone-100 text-stone-600 ring-stone-500/10",
  },
  whatsapp: {
    label: "WhatsApp",
    icon: MessageCircle,
    className: "bg-emerald-50 text-emerald-700 ring-emerald-600/10",
  },
  phone: {
    label: "Teléfono",
    icon: Phone,
    className: "bg-sky-50 text-sky-700 ring-sky-600/10",
  },
} satisfies Record<Channel, { label: string; icon: typeof Phone; className: string }>;

export function ChannelBadge({ channel }: { channel: Channel }) {
  const config = CHANNEL_CONFIG[channel];
  const Icon = config.icon;

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${config.className}`}
    >
      <Icon className="size-3" strokeWidth={1.75} />
      {config.label}
    </span>
  );
}
