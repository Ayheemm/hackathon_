const LUNAR_HOLIDAY_MAP: Record<
  number,
  {
    aidFitr: [Date, Date];
    aidAdha: [Date, Date];
    arafat: Date;
  }
> = {
  2024: {
    aidFitr: [new Date(2024, 3, 10), new Date(2024, 3, 11)],
    aidAdha: [new Date(2024, 5, 16), new Date(2024, 5, 17)],
    arafat: new Date(2024, 5, 15),
  },
  2025: {
    aidFitr: [new Date(2025, 2, 30), new Date(2025, 2, 31)],
    aidAdha: [new Date(2025, 5, 6), new Date(2025, 5, 7)],
    arafat: new Date(2025, 5, 5),
  },
  2026: {
    aidFitr: [new Date(2026, 2, 20), new Date(2026, 2, 21)],
    aidAdha: [new Date(2026, 4, 27), new Date(2026, 4, 28)],
    arafat: new Date(2026, 4, 26),
  },
  2027: {
    aidFitr: [new Date(2027, 2, 10), new Date(2027, 2, 11)],
    aidAdha: [new Date(2027, 4, 17), new Date(2027, 4, 18)],
    arafat: new Date(2027, 4, 16),
  },
  2028: {
    aidFitr: [new Date(2028, 1, 27), new Date(2028, 1, 28)],
    aidAdha: [new Date(2028, 4, 5), new Date(2028, 4, 6)],
    arafat: new Date(2028, 4, 4),
  },
};

export function getTunisianPublicHolidays(year: number): Date[] {
  const fixedHolidays = [
    new Date(year, 2, 20), // 20 Mars
    new Date(year, 2, 21), // 21 Mars
    new Date(year, 3, 9), // 9 Avril
    new Date(year, 4, 1), // 1 Mai
    new Date(year, 6, 25), // 25 Juillet
    new Date(year, 7, 13), // 13 Août
    new Date(year, 9, 15), // 15 Octobre
    new Date(year, 10, 7), // 7 Novembre
  ];

  const lunar = LUNAR_HOLIDAY_MAP[year];
  if (!lunar) {
    return fixedHolidays;
  }

  return [...fixedHolidays, ...lunar.aidFitr, ...lunar.aidAdha, lunar.arafat];
}

export function isWorkingDay(date: Date): boolean {
  const day = date.getDay();
  if (day === 0 || day === 6) {
    return false;
  }

  const holidays = getTunisianPublicHolidays(date.getFullYear());
  return !holidays.some(
    (holiday) =>
      holiday.getFullYear() === date.getFullYear() &&
      holiday.getMonth() === date.getMonth() &&
      holiday.getDate() === date.getDate(),
  );
}

export function adjustToNextWorkingDay(input: Date): Date {
  const date = new Date(input);
  while (!isWorkingDay(date)) {
    date.setDate(date.getDate() + 1);
  }
  return date;
}

export function addDaysExclusive(startDate: Date, days: number): Date {
  const date = new Date(startDate);
  date.setDate(date.getDate() + days);
  return adjustToNextWorkingDay(date);
}

export function daysBetween(start: Date, end: Date): number {
  const oneDay = 1000 * 60 * 60 * 24;
  const startUTC = Date.UTC(start.getFullYear(), start.getMonth(), start.getDate());
  const endUTC = Date.UTC(end.getFullYear(), end.getMonth(), end.getDate());
  return Math.floor((endUTC - startUTC) / oneDay);
}
