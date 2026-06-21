type Props = {
  /** Slot start time in HH:MM format. */
  timeLabel?: string;
  /** Override height in pixels. */
  height?: number;
};

export function EmptySlot({ timeLabel, height = 48 }: Props) {
  return (
    <div
      className="flex items-center border border-dashed border-stone-200 px-3"
      style={{ minHeight: height }}
    >
      <span className="text-xs text-stone-300 select-none">
        {timeLabel ? `${timeLabel} · Hueco libre` : "Hueco libre"}
      </span>
    </div>
  );
}
