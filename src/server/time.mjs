import { Problem } from './security.mjs';
export function localDate(ms = Date.now()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Montevideo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(ms);
}
export function timeNumber(value) {
  if (!/^\d{2}:\d{2}$/.test(value)) throw new Problem(400, 'Revisá las horas.');
  const [h, m] = value.split(':').map(Number);
  if (h > 23 || m > 59) throw new Problem(400, 'Hora inválida.');
  return h * 60 + m;
}
export function zonedTime(date, minutes) {
  const [y, m, d] = date.split('-').map(Number);
  const target = Date.UTC(y, m - 1, d, Math.floor(minutes / 60), minutes % 60);
  let result = target;
  for (let i = 0; i < 3; i++) {
    const parts = Object.fromEntries(
      new Intl.DateTimeFormat('en-CA', {
        timeZone: 'America/Montevideo',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23',
      })
        .formatToParts(result)
        .map((p) => [p.type, p.value]),
    );
    const shown = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute);
    result += target - shown;
  }
  return result;
}
