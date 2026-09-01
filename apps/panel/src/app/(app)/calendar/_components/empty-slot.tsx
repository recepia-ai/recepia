type Props = {
  /** Slot start time in HH:MM format. */
  timeLabel?: string;
  /** Override height in pixels. */
  height?: number;
  onClick?: () => void;
};

export function EmptySlot({ timeLabel, height = 48, onClick }: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className="flex w-full items-center border border-dashed border-stone-200 px-3 text-left transition hover:border-emerald-300 hover:bg-emerald-50/40 disabled:hover:border-stone-200 disabled:hover:bg-transparent"
      style={{ minHeight: height }}
    >
      <span className="text-xs text-stone-300 select-none">
        {timeLabel
          ? `${timeLabel} · Hueco libre`
          : onClick
            ? "Hueco libre · crear cita"
            : "Hueco libre"}
      </span>
    </button>
  );
}
