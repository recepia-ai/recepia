import type { AppointmentWithDetails, BusinessHours, DayHours } from "./types";

// -- Date helpers -----------------------------------------------------------

export function mondayOf(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function addDays(date: Date, n: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

export function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function isToday(d: Date): boolean {
  return sameDay(d, new Date());
}

// -- Spanish labels ---------------------------------------------------------

const DAY_NAMES = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const DAY_NAMES_FULL = [
  "Domingo",
  "Lunes",
  "Martes",
  "Miércoles",
  "Jueves",
  "Viernes",
  "Sábado",
];
const MONTH_NAMES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

export function dayNameShort(d: Date): string {
  return DAY_NAMES[d.getDay()]!;
}
export function dayNameFull(d: Date): string {
  return DAY_NAMES_FULL[d.getDay()]!;
}
export function monthName(d: Date): string {
  return MONTH_NAMES[d.getMonth()]!;
}

// -- Business hours ---------------------------------------------------------

const DAY_KEYS = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
] as const;

export function hoursForDay(hours: BusinessHours | null, date: Date): DayHours {
  if (!hours) return [];
  const key = DAY_KEYS[date.getDay()]!;
  const dayHours = hours[key];
  return Array.isArray(dayHours) ? dayHours : [];
}

export function isClinicOpen(hours: BusinessHours | null, date: Date): boolean {
  return hoursForDay(hours, date).length > 0;
}

// -- Slot generation --------------------------------------------------------

export type Slot = {
  start: string; // HH:MM
  end: string; // HH:MM
};

export function generateSlots(
  dayHours: DayHours,
  slotMinutes: number = 30,
): Slot[] {
  const slots: Slot[] = [];
  for (const block of dayHours) {
    const [sh, sm] = block.start.split(":").map(Number);
    const [eh, em] = block.end.split(":").map(Number);
    let minutes = sh! * 60 + sm!;
    const endMinutes = eh! * 60 + em!;
    while (minutes + slotMinutes <= endMinutes) {
      const startH = Math.floor(minutes / 60);
      const startM = minutes % 60;
      const endH = Math.floor((minutes + slotMinutes) / 60);
      const endM = (minutes + slotMinutes) % 60;
      slots.push({
        start: `${String(startH).padStart(2, "0")}:${String(startM).padStart(2, "0")}`,
        end: `${String(endH).padStart(2, "0")}:${String(endM).padStart(2, "0")}`,
      });
      minutes += slotMinutes;
    }
  }
  return slots;
}

export function earliestSlot(
  hours: BusinessHours | null,
  dates: Date[],
): string {
  let earliest = "23:59";
  for (const d of dates) {
    for (const block of hoursForDay(hours, d)) {
      if (block.start < earliest) earliest = block.start;
    }
  }
  return earliest;
}

export function latestSlot(
  hours: BusinessHours | null,
  dates: Date[],
): string {
  let latest = "00:00";
  for (const d of dates) {
    for (const block of hoursForDay(hours, d)) {
      if (block.end > latest) latest = block.end;
    }
  }
  return latest;
}

export function timeToMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h! * 60 + m!;
}

// -- Appointment filtering --------------------------------------------------

export function appointmentsForDay(
  appointments: AppointmentWithDetails[],
  date: Date,
): AppointmentWithDetails[] {
  return appointments.filter((a) => {
    const start = new Date(a.starts_at);
    return sameDay(start, date);
  });
}

export function appointmentsForSlot(
  appointments: AppointmentWithDetails[],
  date: Date,
  slotStart: string,
  slotEnd: string,
): AppointmentWithDetails[] {
  const dayApps = appointmentsForDay(appointments, date);
  return dayApps.filter((a) => {
    const aStart = new Date(a.starts_at);
    const aStartMin =
      aStart.getHours() * 60 + aStart.getMinutes();
    const slotStartMin = timeToMinutes(slotStart);
    const slotEndMin = timeToMinutes(slotEnd);
    // Appointment overlaps this slot if it starts before slot end and ends after slot start
    const aEnd = new Date(a.ends_at);
    const aEndMin = aEnd.getHours() * 60 + aEnd.getMinutes();
    return aStartMin < slotEndMin && aEndMin > slotStartMin;
  });
}

// -- Month grid -------------------------------------------------------------

export function monthGrid(date: Date): Date[][] {
  const year = date.getFullYear();
  const month = date.getMonth();
  const firstDay = new Date(year, month, 1);
  const startDay = firstDay.getDay(); // 0=Sun
  // Start from Monday of the week containing the 1st
  const gridStart = addDays(firstDay, startDay === 0 ? -6 : 1 - startDay);

  const weeks: Date[][] = [];
  let current = gridStart;
  // 6 weeks to cover all cases
  for (let w = 0; w < 6; w++) {
    const week: Date[] = [];
    for (let d = 0; d < 7; d++) {
      week.push(new Date(current));
      current = addDays(current, 1);
    }
    weeks.push(week);
  }
  return weeks;
}

export function isSameMonth(d: Date, reference: Date): boolean {
  return d.getMonth() === reference.getMonth();
}
