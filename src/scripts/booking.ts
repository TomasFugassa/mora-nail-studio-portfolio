export {};
type Service = { id: string; name: string; minutes: number };
type Availability = {
  demo: boolean;
  enabled: boolean;
  services: Service[];
  dates: string[];
  rules: { minLeadMinutes: number; bufferMinutes: number; startIntervalMinutes: number };
  slots: { start: number; time: string }[];
};
const form = document.querySelector<HTMLFormElement>('#booking-form'),
  service = document.querySelector<HTMLSelectElement>('#booking-service'),
  date = document.querySelector<HTMLSelectElement>('#booking-date'),
  slots = document.getElementById('booking-slots'),
  submit = document.querySelector<HTMLButtonElement>('#booking-submit'),
  status = document.getElementById('booking-status');
let selected: number | null = null,
  key = crypto.randomUUID(),
  loading = false,
  requestVersion = 0,
  sitePhone = '';
const message = (text: string) => {
  if (status) status.textContent = text;
};
function options(
  select: HTMLSelectElement,
  items: { value: string; label: string }[],
  placeholder: string,
) {
  select.replaceChildren(
    new Option(placeholder, ''),
    ...items.map((i) => new Option(i.label, i.value)),
  );
}
async function load() {
  if (!service || !date || !slots || !submit) return;
  const version = ++requestVersion;
  selected = null;
  submit.disabled = true;
  message('');
  const selection = document.getElementById('booking-selection');
  if (selection) selection.hidden = true;
  const rules = document.getElementById('booking-rules');
  if (rules) rules.textContent = '';
  slots.textContent = 'Cargando horarios…';
  try {
    const res = await fetch(
      `/api/availability?service=${encodeURIComponent(service.value)}&date=${encodeURIComponent(date.value)}`,
      { cache: 'no-store' },
    );
    const data: Availability & { error?: string } = await res.json();
    if (!res.ok) throw Error(data.error);
    if (version !== requestVersion) return;
    const currentService = service.value;
    options(
      service,
      data.services.map((s) => ({ value: s.id, label: s.name + ' · ' + s.minutes + ' min' })),
      'Elegí un servicio',
    );
    service.value = currentService;
    const chosen = data.services.find((s) => s.id === service.value);
    if (rules && chosen) {
      rules.textContent =
        'Inicios cada ' +
        data.rules.startIntervalMinutes +
        ' min. Atención: ' +
        chosen.minutes +
        ' min.' +
        (data.rules.bufferMinutes
          ? ' Descanso posterior: ' + data.rules.bufferMinutes + ' min.'
          : '') +
        (data.rules.minLeadMinutes
          ? ' Anticipación mínima: ' + data.rules.minLeadMinutes + ' min.'
          : '');
    }
    const previous = date.value;
    options(
      date,
      data.dates.map((d) => ({
        value: d,
        label: new Intl.DateTimeFormat('es-UY', {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
          timeZone: 'America/Montevideo',
        }).format(new Date(d + 'T12:00:00Z')),
      })),
      'Elegí un día',
    );
    date.value = previous;
    date.disabled = !service.value || !data.enabled;
    service.disabled = !data.enabled;
    slots.replaceChildren();
    if (!data.enabled) {
      slots.textContent =
        'La agenda online todavía no está habilitada. Podés consultar por WhatsApp.';
      return;
    }
    if (!service.value || !date.value) {
      slots.textContent = data.dates.length
        ? 'Elegí servicio y día para ver los horarios.'
        : 'Todavía no hay horarios publicados. Consultá con el estudio.';
      return;
    }
    if (!data.slots.length) {
      slots.textContent = 'No quedan horarios para este servicio en ese día. Probá otra fecha.';
      return;
    }
    for (const slot of data.slots) {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = slot.time;
      button.className = 'slot-button';
      button.setAttribute('aria-pressed', 'false');
      button.addEventListener('click', () => {
        selected = slot.start;
        key = crypto.randomUUID();
        slots
          .querySelectorAll('button')
          .forEach((b) => b.setAttribute('aria-pressed', String(b === button)));
        submit.disabled = false;
        if (selection && chosen) {
          const end = new Intl.DateTimeFormat('es-UY', {
            timeZone: 'America/Montevideo',
            hour: '2-digit',
            minute: '2-digit',
            hourCycle: 'h23',
          }).format(slot.start + chosen.minutes * 60000);
          selection.textContent =
            slot.time +
            ' — ' +
            end +
            ' · ' +
            chosen.name +
            (data.rules.bufferMinutes
              ? ' · después, ' + data.rules.bufferMinutes + ' min de descanso'
              : '');
          selection.hidden = false;
        }
      });
      slots.append(button);
    }
  } catch (error) {
    message(error instanceof Error ? error.message : 'No pudimos cargar la agenda.');
  }
}
service?.addEventListener('change', () => {
  if (date) date.value = '';
  void load();
});
date?.addEventListener('change', () => {
  void load();
});
form?.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (loading || !selected || !service || !submit) return;
  loading = true;
  submit.disabled = true;
  message('Guardando tu turno…');
  try {
    const reference = document.getElementById('reference-name')?.textContent || '';
    const res = await fetch('/api/booking', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        serviceId: service.value,
        start: selected,
        name: document.querySelector<HTMLInputElement>('#booking-name')?.value,
        phone: document.querySelector<HTMLInputElement>('#booking-phone')?.value,
        reference,
        requestKey: key,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      if (res.status === 409) await load();
      throw Error(data.error || 'No pudimos guardar el turno.');
    }
    form.hidden = true;
    const result = document.getElementById('booking-result');
    if (result) result.hidden = false;
    const when = new Intl.DateTimeFormat('es-UY', {
      dateStyle: 'full',
      timeStyle: 'short',
      timeZone: 'America/Montevideo',
    }).format(data.start);
    const summary = document.getElementById('booking-summary');
    if (summary) summary.textContent = `${data.service} · ${when} (Uruguay)`;
    const label = document.getElementById('booking-result-label');
    if (label && data.demo) label.textContent = 'Reserva de demostración guardada';
    const link = document.querySelector<HTMLAnchorElement>('#booking-private-link');
    if (link) link.href = '/mi-turno#token=' + encodeURIComponent(data.token);
    const wa = document.querySelector<HTMLAnchorElement>('#booking-whatsapp');
    if (wa) wa.hidden = true;
    message(
      data.demo
        ? 'Turno de prueba guardado; no corresponde a una cita real.'
        : 'Reserva guardada. No necesitás abrir WhatsApp para confirmarla.',
    );
  } catch (error) {
    message(
      error instanceof Error
        ? error.message
        : 'No se recibió confirmación. Reintentá sin cambiar los datos para recuperar la misma solicitud.',
    );
    if (submit && selected) submit.disabled = false;
  } finally {
    loading = false;
  }
});
document.getElementById('booking-another')?.addEventListener('click', () => {
  if (form) form.hidden = false;
  const result = document.getElementById('booking-result');
  if (result) result.hidden = true;
  key = crypto.randomUUID();
  void load();
});
document.addEventListener('visibilitychange', () => {
  if (!document.hidden && form && !form.hidden) void load();
});
void load();
document.getElementById('load-map')?.addEventListener('click', () => {
  const button = document.getElementById('load-map'),
    map = document.getElementById('studio-map') as HTMLIFrameElement | null;
  if (button?.dataset.mapSrc && map) {
    map.src = button.dataset.mapSrc;
    map.hidden = false;
    document.getElementById('map-placeholder')?.setAttribute('hidden', '');
  }
});
