import { headingText } from '../lib/headings';
import { randomId } from '../lib/browser-id';
export {};
const $ = (id) => document.getElementById(id),
  editor = $('admin-editor'),
  dialog = $('editor-dialog');
const photoMap = JSON.parse($('admin-photo-map').textContent);
let data,
  bookings = [],
  tab = 'home',
  day = today(),
  month = day.slice(0, 7),
  filter = 'all',
  query = '',
  modalDirty = false,
  busy = false,
  toastTimer,
  renderedTab;
const states = { confirmed: 'Confirmado', completed: 'Realizado', cancelled: 'Cancelado' };
const sections = {
  home: 'Inicio',
  agenda: 'Agenda',
  clients: 'Clientes',
  photos: 'Galería',
  services: 'Servicios',
  hours: 'Horarios',
  content: 'Tu página',
  location: 'Ubicación',
  access: 'Acceso',
};
const paths = {
  home: 'M3 10 12 3l9 7v11h-6v-7H9v7H3Z',
  calendar: 'M4 5h16v16H4ZM8 2v6m8-6v6M4 11h16',
  users:
    'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2m20 0v-2a4 4 0 0 0-3-3.87M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8m8-7a4 4 0 0 1 0 8',
  image: 'M3 3h18v18H3Zm0 13 5-5 5 5 3-3 5 5M15 7h.01',
  spark: 'M15 3l6 6-9 9-6-6ZM6 12l-2 2a4 4 0 0 0 0 6c2 1 5 0 6-2l2-2M13 5l6 6',
  clock: 'M12 8v5l3 2M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0',
  layout: 'M3 3h18v18H3Zm0 6h18M9 9v12',
  pin: 'M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0M15 10a3 3 0 1 1-6 0 3 3 0 0 1 6 0',
  lock: 'M5 10h14v11H5Zm3 0V6a4 4 0 0 1 8 0v4',
  menu: 'M4 6h16M4 12h16M4 18h16',
  plus: 'M12 4v16M4 12h16',
  arrow: 'M5 12h14m-6-6 6 6-6 6',
  upload: 'M12 16V3m-5 5 5-5 5 5M4 16v5h16v-5',
  check: 'm5 12 4 4L19 6',
  search: 'M21 21l-5-5m2-6a8 8 0 1 1-16 0 8 8 0 0 1 16 0',
};
function icon(name) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '1.6');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('aria-hidden', 'true');
  const p = document.createElementNS(svg.namespaceURI, 'path');
  p.setAttribute('d', paths[name] || paths.spark);
  svg.append(p);
  return svg;
}
function el(tag, text, cls) {
  const n = document.createElement(tag);
  if (text !== undefined)
    n.textContent =
      /^h[1-6]$/.test(tag) || ['view-description', 'eyebrow'].includes(cls)
        ? headingText(text)
        : text;
  if (cls) n.className = cls;
  return n;
}
function today(ms = Date.now()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Montevideo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(ms);
}
const dateLabel = (value, options = { weekday: 'long', day: 'numeric', month: 'long' }) =>
  new Intl.DateTimeFormat('es-UY', { timeZone: 'America/Montevideo', ...options }).format(
    typeof value === 'string' ? new Date(value + 'T12:00:00Z') : value,
  );
const time = (ms) =>
  new Intl.DateTimeFormat('es-UY', {
    timeZone: 'America/Montevideo',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(ms);
const photoSrc = (p) => photoMap[p.image] || p.image;
const phoneKey = (p) => p.replace(/\D/g, '').replace(/^0/, '598');
function status(message, error = false) {
  clearTimeout(toastTimer);
  $('admin-status').textContent = message;
  $('admin-status').classList.toggle('is-error', error);
  $('admin-status').hidden = false;
  toastTimer = setTimeout(() => ($('admin-status').hidden = true), error ? 9000 : 4500);
}
async function api(payload) {
  if (!navigator.onLine)
    throw Error('Estás sin conexión. Volvé a conectarte para guardar los cambios.');
  const res = await fetch(
    '/api/admin',
    payload
      ? {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }
      : { cache: 'no-store' },
  );
  let result;
  try {
    result = await res.json();
  } catch {
    throw Error('No se pudo conectar con el estudio. Reintentá en un momento.');
  }
  if (!res.ok) {
    if (res.status === 401) {
      if (result.reviewRequired) window.location.replace('/revision?next=%2Fadmin');
      data = null;
      bookings = [];
      editor.replaceChildren();
      dialog.close();
      $('admin-workspace').hidden = true;
      $('admin-login').hidden = false;
      document.body.classList.remove('is-authenticated');
    }
    const error = Error(result.error || 'No pudimos guardar los cambios.');
    error.status = res.status;
    throw error;
  }
  return result;
}
function button(parent, label, action, cls = 'secondary', ico) {
  const b = el('button', undefined, cls);
  b.type = 'button';
  if (ico) b.append(icon(ico));
  b.append(el('span', label));
  b.addEventListener('click', async () => {
    try {
      await action();
    } catch (e) {
      status(e.message, true);
    }
  });
  parent.append(b);
  return b;
}
let fieldId = 0;
function field(parent, label, value, options = {}) {
  const wrap = el('div', undefined, 'editor-field');
  const caption = el('label', label),
    id = 'field-' + ++fieldId;
  caption.htmlFor = id;
  wrap.append(caption);
  const input = el(options.type === 'textarea' ? 'textarea' : 'input');
  input.id = id;
  if (options.type !== 'textarea') input.type = options.type || 'text';
  input.value = value ?? '';
  for (const key of ['required', 'min', 'max', 'maxLength', 'autocomplete', 'placeholder'])
    if (options[key] !== undefined) input[key] = options[key];
  input.addEventListener('input', () => (modalDirty = true));
  wrap.append(input);
  if (options.help) {
    const help = el('small', options.help);
    help.id = id + '-help';
    input.setAttribute('aria-describedby', help.id);
    wrap.append(help);
  }
  parent.append(wrap);
  return input;
}
function select(parent, label, value, options) {
  const wrap = el('label', undefined, 'editor-field');
  wrap.append(el('span', label));
  const input = el('select');
  options.forEach(([v, t]) => input.add(new Option(t, v)));
  input.value = value;
  input.addEventListener('change', () => (modalDirty = true));
  wrap.append(input);
  parent.append(wrap);
  return input;
}
function toggle(parent, label, value, help) {
  const wrap = el('label', undefined, 'switch-field'),
    input = el('input');
  input.type = 'checkbox';
  input.checked = !!value;
  input.addEventListener('change', () => (modalDirty = true));
  const text = el('span');
  text.append(el('strong', label));
  if (help) text.append(el('small', help));
  wrap.append(text, input, el('span', undefined, 'switch-track'));
  parent.append(wrap);
  return input;
}
function modal(title, description, build) {
  if (dialog.open) dialog.close();
  $('dialog-heading').textContent = headingText(title);
  $('dialog-body').replaceChildren();
  if (description) $('dialog-body').append(el('p', description, 'dialog-description'));
  modalDirty = false;
  build($('dialog-body'));
  dialog.showModal();
}
function closeModal() {
  if (busy) return;
  if (modalDirty) {
    if (!confirm('Tenés cambios sin guardar. ¿Querés descartarlos?')) return;
  }
  modalDirty = false;
  dialog.close();
}
function formModal(
  title,
  description,
  build,
  save,
  label = 'Guardar cambios',
  success = 'Listo. Tus cambios ya se guardaron.',
) {
  modal(title, description, (container) => {
    const form = el('form', undefined, 'modal-form'),
      content = el('div', undefined, 'form-content');
    form.append(content);
    const read = build(content),
      error = el('p', undefined, 'inline-error');
    error.setAttribute('role', 'alert');
    const actions = el('div', undefined, 'modal-actions');
    button(actions, 'Volver', closeModal, 'secondary');
    const submit = el('button', label, 'primary');
    submit.type = 'submit';
    actions.append(submit);
    const ready = () => !busy && (!read.canSubmit || read.canSubmit());
    submit.disabled = !ready();
    form.addEventListener('bere:ready', () => (submit.disabled = !ready()));
    form.append(error, actions);
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (busy) return;
      busy = true;
      submit.disabled = true;
      submit.textContent = 'Guardando…';
      error.textContent = '';
      try {
        await save(read());
        modalDirty = false;
        dialog.close();
        render();
        status(success);
      } catch (e) {
        error.textContent = e.message;
      } finally {
        busy = false;
        submit.disabled = !ready();
        submit.textContent = label;
      }
    });
    container.append(form);
  });
}
async function commit(mutator) {
  const draft = structuredClone(data);
  mutator(draft);
  const result = await api({ action: 'save', content: draft });
  data = result.content;
}
function confirmation(title, description, action, label = 'Confirmar') {
  modal(title, description, (container) => {
    const actions = el('div', undefined, 'modal-actions');
    button(actions, 'Volver', closeModal);
    button(
      actions,
      label,
      async () => {
        if (busy) return;
        busy = true;
        try {
          await action();
          modalDirty = false;
          dialog.close();
          render();
          status('Listo. La agenda está actualizada.');
        } finally {
          busy = false;
        }
      },
      'primary',
    );
    container.append(actions);
  });
}
function heading(kicker, title, description, action) {
  const h = el('div', undefined, 'view-heading'),
    copy = el('div');
  copy.append(el('p', kicker, 'eyebrow'), el('h1', title));
  if (description) copy.append(el('p', description, 'view-description'));
  h.append(copy);
  if (action) action(h);
  editor.append(h);
}
function empty(parent, title, description, ico = 'calendar') {
  const box = el('div', undefined, 'empty-state');
  box.append(icon(ico), el('h3', title), el('p', description));
  parent.append(box);
}
function go(next) {
  tab = next;
  query = '';
  filter = 'all';
  render();
  window.scrollTo({
    top: 0,
    behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth',
  });
}
function render() {
  if (!data) return;
  editor.replaceChildren();
  editor.dataset.view = tab;
  document.querySelectorAll('[data-tab],[data-route]').forEach((b) => {
    if ((b.dataset.tab || b.dataset.route) === tab) b.setAttribute('aria-current', 'page');
    else b.removeAttribute('aria-current');
  });
  $('panel-breadcrumb').lastElementChild.textContent = sections[tab];
  $('mobile-section-label').textContent = sections[tab];
  if (!['home', 'agenda', 'photos'].includes(tab)) $('more-nav').setAttribute('aria-current', 'page');
  else $('more-nav').removeAttribute('aria-current');
  ({
    home: homeView,
    agenda: agendaView,
    clients: clientsView,
    photos: photosView,
    services: servicesView,
    hours: hoursView,
    content: contentView,
    location: locationView,
    access: accessView,
  })[tab]();
  if (renderedTab !== tab && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
    [...editor.children].forEach((element, index) => element.animate(
      [{ opacity: 0, transform: 'translateY(14px)' }, { opacity: 1, transform: 'translateY(0)' }],
      { duration: 440, delay: Math.min(index, 5) * 40, easing: 'cubic-bezier(.22,.7,.2,1)', fill: 'backwards' },
    ));
  }
  renderedTab = tab;
}
function bookingRow(parent, b) {
  const row = el('button', undefined, 'booking-row');
  row.type = 'button';
  const when = el('span', time(b.start), 'booking-time'),
    avatar = el(
      'span',
      b.service === 'Horario bloqueado' ? '—' : b.name.slice(0, 1).toUpperCase(),
      'client-avatar',
    ),
    copy = el('span', undefined, 'booking-copy');
  copy.append(
    el('strong', b.service === 'Horario bloqueado' ? b.service : b.name),
    el('small', b.service === 'Horario bloqueado' ? b.name : b.service),
  );
  row.append(
    when,
    avatar,
    copy,
    el('span', states[b.status], 'state-pill ' + b.status),
    icon('arrow'),
  );
  row.addEventListener('click', () => bookingDetail(b));
  parent.append(row);
}
function bookingDetail(b) {
  modal(
    b.service === 'Horario bloqueado' ? 'Un espacio reservado' : b.name,
    dateLabel(b.start) + ' · ' + time(b.start) + ' · Uruguay',
    (container) => {
      const facts = el('div', undefined, 'booking-facts');
      facts.append(el('span', states[b.status], 'state-pill ' + b.status), el('h3', b.service));
      if (b.phone) facts.append(el('p', b.phone));
      if (b.reference) facts.append(el('p', 'Inspiración: ' + b.reference));
      if (b.service === 'Horario bloqueado') facts.append(el('p', 'Hasta las ' + time(b.end)));
      container.append(facts);
      if (b.phone) {
        const wa = el('a', 'Conversar por WhatsApp ↗', 'primary link-button');
        wa.href = 'https://wa.me/' + phoneKey(b.phone);
        wa.target = '_blank';
        wa.rel = 'noopener noreferrer';
        container.append(wa);
      }
      if (b.status === 'confirmed') {
        const actions = el('div', undefined, 'detail-actions');
        if (b.service !== 'Horario bloqueado') {
          const complete = button(
            actions,
            'Marcar realizado',
            () =>
              confirmation(
                '¿Terminó este encuentro?',
                'Se conservará en el historial. Marcarlo realizado no libera anticipadamente el horario ni su descanso.',
                async () => {
                  bookings = (await api({ action: 'booking', id: b.id, status: 'completed' }))
                    .bookings;
                },
                'Marcar realizado',
              ),
            'secondary',
            'check',
          );
          if (b.start > Date.now()) {
            complete.disabled = true;
            actions.append(
              el(
                'p',
                'Podés marcarlo realizado desde su hora de inicio. Para liberar el espacio, cancelá el turno.',
                'completion-note',
              ),
            );
          }
        }
        button(
          actions,
          b.service === 'Horario bloqueado' ? 'Liberar horario' : 'Cancelar turno',
          () =>
            confirmation(
              '¿Liberar este horario?',
              'Volverá a estar disponible para recibir reservas.',
              async () => {
                bookings = (await api({ action: 'booking', id: b.id, status: 'cancelled' }))
                  .bookings;
              },
              'Liberar horario',
            ),
          'danger-text',
        );
        container.append(actions);
      }
    },
  );
}
function homeView() {
  const upcoming = bookings
      .filter((b) => b.status === 'confirmed' && b.start >= Date.now() && b.phone)
      .sort((a, b) => a.start - b.start),
    todays = bookings.filter((b) => today(b.start) === today() && b.status === 'confirmed');
  heading(dateLabel(today()), 'Hoy en Mora', 'Tu agenda, tus diseños y tu página, en un mismo lugar.', (h) =>
    button(
      h,
      'Ver mi página',
      () => window.open('/', '_blank', 'noopener,noreferrer'),
      'secondary',
      'arrow',
    ),
  );
  const featured = data.collection.photos.find((photo) => photo.id === data.collection.heroId);
  const hero = el('div', undefined, 'dashboard-hero'),
    copy = el('div', undefined, 'dashboard-copy');
  copy.append(
    el('p', 'LA AGENDA DEL ESTUDIO', 'eyebrow'),
    el('h2', 'Cada turno,\nen su lugar'),
    el('p', 'Agendá una visita, revisá los próximos turnos y actualizá tu colección.'),
  );
  const actions = el('div', undefined, 'hero-quick');
  button(actions, 'Agendar un turno', manualBookingDialog, 'light-button', 'calendar');
  button(actions, 'Subir un diseño', () => editPhoto(), 'transparent-light', 'plus');
  copy.append(actions);
  const visual = el('figure', undefined, 'dashboard-visual'),
    heroPhoto = el('img'),
    caption = el('figcaption');
  heroPhoto.src = photoSrc(featured);
  heroPhoto.alt = featured.alt;
  heroPhoto.width = 600;
  heroPhoto.height = 750;
  caption.append(el('span', 'DE TU COLECCIÓN'), el('strong', featured.title));
  visual.append(heroPhoto, caption);
  hero.append(copy, visual);
  editor.append(hero);
  const stats = el('div', undefined, 'stat-grid');
  [
    ['Hoy', String(todays.length), 'encuentros en tu agenda', 'calendar'],
    [
      'Próximo encuentro',
      upcoming.length ? time(upcoming[0].start) : '—',
      upcoming.length
        ? dateLabel(upcoming[0].start, { day: 'numeric', month: 'short' }) +
          ' · ' +
          upcoming[0].name
        : 'Tu próximo turno aparecerá acá',
      'clock',
    ],
    ['Tu colección', String(data.collection.photos.length), 'diseños para inspirar', 'image'],
  ].forEach(([label, value, note, ico]) => {
    const c = el('div', undefined, 'stat-card');
    c.append(icon(ico), el('p', label), el('strong', value), el('small', note));
    stats.append(c);
  });
  editor.append(stats);
  const grid = el('div', undefined, 'home-grid'),
    agenda = el('section', undefined, 'surface'),
    top = el('div', undefined, 'surface-heading');
    top.append(el('h2', 'Próximos turnos'));
  button(top, 'Ver agenda', () => go('agenda'), 'text-button');
  agenda.append(top);
  if (!upcoming.length)
    empty(agenda, 'Tu agenda tiene espacio', 'Cuando alguien reserve, su turno aparecerá acá.');
  upcoming.slice(0, 4).forEach((b) => {
    const wrap = el('div', undefined, 'upcoming-item');
    wrap.append(el('p', dateLabel(b.start), 'date-separator'));
    bookingRow(wrap, b);
    agenda.append(wrap);
  });
  const side = el('section', undefined, 'inspiration-card');
  const image = el('img');
  image.src = photoSrc(data.collection.photos.find((p) => p.id === data.collection.heroId));
  image.alt = 'Diseño destacado de la colección';
  side.append(
    image,
    el('p', 'EN TU PÁGINA', 'eyebrow'),
    el('h2', featured.title),
  );
  button(side, 'Ir a mi galería', () => go('photos'), 'text-button', 'arrow');
  grid.append(agenda, side);
  editor.append(grid);
  const shortcuts = el('div', undefined, 'shortcut-grid');
  [
    ['hours', 'Horarios de atención', 'Publicá días y franjas disponibles.', 'clock'],
    ['services', 'Servicios y duración', 'Actualizá las técnicas que ofrecés.', 'spark'],
    ['content', 'Contenido de tu página', 'Editá los textos y tus datos.', 'layout'],
  ].forEach(([route, title, text, ico]) => {
    const b = button(shortcuts, title, () => go(route), 'shortcut-card', ico);
    b.append(el('small', text));
  });
  editor.append(shortcuts);
}
function monthCalendar(parent, onDay) {
  const card = el('div', undefined, 'calendar-card'),
    top = el('div', undefined, 'calendar-heading');
  const move = (n) => {
    const d = new Date(month + '-01T12:00:00Z');
    d.setUTCMonth(d.getUTCMonth() + n);
    month = d.toISOString().slice(0, 7);
    render();
  };
  button(top, '‹', () => move(-1), 'icon-button').setAttribute('aria-label', 'Mes anterior');
  top.append(el('h2', dateLabel(month + '-01', { month: 'long', year: 'numeric' })));
  button(top, '›', () => move(1), 'icon-button').setAttribute('aria-label', 'Mes siguiente');
  card.append(top);
  const grid = el('div', undefined, 'calendar-grid');
  ['L', 'M', 'M', 'J', 'V', 'S', 'D'].forEach((d) => grid.append(el('span', d, 'weekday')));
  const d = new Date(month + '-01T12:00:00Z'),
    offset = (d.getUTCDay() + 6) % 7,
    days = new Date(d.getUTCFullYear(), d.getUTCMonth() + 1, 0).getDate();
  for (let i = 0; i < offset; i++) grid.append(el('span'));
  for (let i = 1; i <= days; i++) {
    const value = month + '-' + String(i).padStart(2, '0'),
      b = el('button', String(i), 'calendar-day');
    b.type = 'button';
    b.setAttribute('aria-label', dateLabel(value));
    b.setAttribute('aria-pressed', String(value === day));
    if (value === today()) b.classList.add('is-today');
    if (bookings.some((x) => today(x.start) === value && x.status === 'confirmed'))
      b.classList.add('has-bookings');
    b.addEventListener('click', () => {
      day = value;
      onDay();
    });
    grid.append(b);
  }
  card.append(grid, el('p', '• Días con encuentros confirmados', 'calendar-legend'));
  parent.append(card);
}
function agendaView() {
  heading(
    'UN ESPACIO PARA CADA ENCUENTRO',
    'Tu agenda.',
    'Elegí un día para ver y organizar los turnos.',
    (h) => {
      const actions = el('div', undefined, 'agenda-actions');
      button(actions, 'Agendar turno', manualBookingDialog, 'primary', 'plus');
      button(actions, 'Bloquear horario', blockDialog, 'secondary', 'clock');
      h.append(actions);
    },
  );
  const layout = el('div', undefined, 'agenda-layout'),
    side = el('div');
  monthCalendar(side, render);
  button(
    side,
    'Volver a hoy',
    () => {
      day = today();
      month = day.slice(0, 7);
      render();
    },
    'text-button',
  );
  const list = el('section', undefined, 'surface agenda-list'),
    top = el('div', undefined, 'surface-heading');
  top.append(el('h2', dateLabel(day)));
  button(top, 'Actualizar agenda', refresh, 'icon-button', 'clock');
  list.append(top);
  const controls = el('div', undefined, 'segmented');
  [
    ['all', 'Todos'],
    ['confirmed', 'Confirmados'],
    ['completed', 'Realizados'],
    ['cancelled', 'Cancelados'],
  ].forEach(([v, label]) => {
    const b = button(
      controls,
      label,
      () => {
        filter = v;
        render();
      },
      filter === v ? 'selected' : '',
    );
    b.setAttribute('aria-pressed', String(filter === v));
  });
  list.append(controls);
  const selected = bookings
    .filter((b) => today(b.start) === day && (filter === 'all' || b.status === filter))
    .sort((a, b) => a.start - b.start);
  if (!selected.length)
    empty(
      list,
      'Un día con espacio',
      'Los turnos de esta fecha aparecerán acá. Podés abrir horarios desde Horarios.',
    );
  selected.forEach((b) => bookingRow(list, b));
  layout.append(side, list);
  editor.append(layout);
}
function blockDialog() {
  formModal(
    'Bloquear un horario',
    'Bloqueá compromisos o turnos que coordinaste por otro medio.',
    (c) => {
      const d = field(c, 'Día', day, { type: 'date', required: true, min: today() }),
        row = el('div', undefined, 'form-row');
      c.append(row);
      const start = field(row, 'Desde', '09:00', { type: 'time', required: true }),
        end = field(row, 'Hasta', '10:00', { type: 'time', required: true }),
        note = field(c, 'Motivo (solo para vos)', '', {
          placeholder: 'Ej.: turno coordinado por WhatsApp',
          maxLength: 100,
        });
      return () => ({ date: d.value, start: start.value, end: end.value, note: note.value });
    },
    async (values) => {
      bookings = (await api({ action: 'block', ...values })).bookings;
      day = values.date;
      month = day.slice(0, 7);
    },
    'Bloquear horario',
  );
}
function photosView() {
  heading(
    'LA COLECCIÓN MORA',
    'Tu colección.',
    'Tus trabajos, protagonistas. Tocá una foto para editarla.',
    (h) => button(h, 'Agregar diseño', () => editPhoto(), 'primary', 'plus'),
  );
  const tools = el('div', undefined, 'gallery-toolbar'),
    filters = el('div', undefined, 'segmented');
  [
    ['all', 'Todos'],
    ['sutil', 'Sutiles'],
    ['color', 'Con color'],
    ['arte', 'Nail art'],
  ].forEach(([v, label]) => {
    const b = button(
      filters,
      label,
      () => {
        filter = v;
        render();
      },
      filter === v ? 'selected' : '',
    );
    b.setAttribute('aria-pressed', String(filter === v));
  });
  tools.append(filters, el('span', data.collection.photos.length + ' diseños', 'muted'));
  editor.append(tools);
  const grid = el('div', undefined, 'photo-grid');
  const add = button(grid, 'Nuevo diseño', () => editPhoto(), 'add-photo-card', 'plus');
  add.append(el('small', 'Subí tu próximo trabajo'));
  data.collection.photos
    .filter((p) => filter === 'all' || p.category === filter)
    .forEach((p) => {
      const card = el('article', undefined, 'photo-card'),
        open = el('button', undefined, 'photo-edit');
      open.type = 'button';
      open.setAttribute('aria-label', 'Editar diseño ' + p.title);
      const img = el('img');
      img.src = photoSrc(p);
      img.alt = p.alt;
      img.loading = 'lazy';
      open.append(img, el('span', 'Editar diseño ↗', 'photo-overlay'));
      open.addEventListener('click', () => editPhoto(p.id));
      card.append(open);
      const folio = el('span', String(data.collection.photos.indexOf(p) + 1).padStart(2, '0'), 'admin-photo-index');
      folio.setAttribute('aria-hidden', 'true');
      card.append(folio);
      if (p.id === data.collection.heroId) card.append(el('span', 'Portada', 'cover-badge'));
      const caption = el('div', undefined, 'photo-card-copy');
      caption.append(
        el('h2', p.title),
        el('span', { sutil: 'Sutil', color: 'Con color', arte: 'Nail art' }[p.category]),
      );
      card.append(caption);
      grid.append(card);
    });
  editor.append(grid);
}
function editPhoto(id) {
  const original = data.collection.photos.find((p) => p.id === id),
    draft = original
      ? { ...original }
      : { id: randomId(), title: '', alt: '', category: 'arte', image: '' };
  let uploading = false;
  formModal(
    original ? 'Editar diseño' : 'Nuevo diseño',
    'Elegí una fotografía, un nombre y su estilo. Las demás opciones son opcionales.',
    (c) => {
      const upload = el('div', undefined, 'upload-zone'),
        image = el('img');
      if (draft.image) {
        image.src = photoSrc(draft);
        image.alt = draft.alt;
        upload.append(image);
      }
      const file = el('input');
      file.type = 'file';
      file.accept = 'image/jpeg,image/png,image/webp';
      file.id = 'photo-file';
      file.className = 'visually-hidden';
      const label = el('label', undefined, 'upload-label');
      label.htmlFor = file.id;
      label.append(
        icon('upload'),
        el('strong', original ? 'Cambiar fotografía' : 'Elegir una fotografía'),
        el('span', 'o arrastrala hasta acá'),
        el('small', 'JPG, PNG o WebP · hasta 3 MB'),
      );
      upload.append(label, file);
      c.append(upload);
      const progress = el('p', undefined, 'upload-status');
      progress.setAttribute('role', 'status');
      c.append(progress);
      async function uploadFile(selected) {
        if (!selected || uploading) return;
        uploading = true;
        busy = true;
        progress.textContent = 'Preparando tu fotografía…';
        upload.classList.add('is-uploading');
        try {
          if (!navigator.onLine) throw Error('Necesitás conexión para subir la foto.');
          const form = new FormData();
          form.append('file', selected);
          const res = await fetch('/api/upload', { method: 'POST', body: form });
          const result = await res.json();
          if (!res.ok) throw Error(result.error || 'No pudimos subir la foto.');
          draft.image = result.url;
          image.src = result.url;
          image.alt = 'Vista previa del diseño';
          upload.prepend(image);
          modalDirty = true;
          progress.textContent = 'Foto lista. Guardá el diseño para sumarlo a la página.';
        } catch (error) {
          progress.textContent = error.message;
        } finally {
          uploading = false;
          busy = false;
          upload.classList.remove('is-uploading');
        }
      }
      file.addEventListener('change', () => uploadFile(file.files[0]));
      ['dragenter', 'dragover'].forEach((name) =>
        upload.addEventListener(name, (e) => {
          e.preventDefault();
          upload.classList.add('is-dragging');
        }),
      );
      ['dragleave', 'drop'].forEach((name) =>
        upload.addEventListener(name, (e) => {
          e.preventDefault();
          upload.classList.remove('is-dragging');
          if (name === 'drop') void uploadFile(e.dataTransfer.files[0]);
        }),
      );
      const title = field(c, 'Nombre del diseño', draft.title, {
          required: true,
          maxLength: 100,
          placeholder: 'Ej.: Un toque de primavera',
        }),
        category = select(c, 'Estilo', draft.category, [
          ['sutil', 'Sutil'],
          ['color', 'Con color'],
          ['arte', 'Nail art'],
        ]);
      const advanced = el('details', undefined, 'optional-settings');
      advanced.append(el('summary', 'Más opciones'));
      c.append(advanced);
      const alt = field(advanced, 'Descripción de la foto', draft.alt, {
          maxLength: 250,
          help: 'Ayuda a quienes usan lectores de pantalla. Si la dejás vacía, usamos el nombre del diseño.',
        }),
        main = toggle(advanced, 'Usar como portada principal', data.collection.heroId === id);
      if (original)
        button(
          advanced,
          'Eliminar diseño',
          () =>
            confirmation(
              '¿Quitamos este diseño?',
              'Se retirará de la colección. Si está en portada, se usará otro diseño.',
              async () => {
                if (data.collection.photos.length <= 1)
                  throw Error('Conservá al menos un diseño en la colección.');
                await commit((d) => {
                  d.collection.photos = d.collection.photos.filter((p) => p.id !== id);
                  if (d.collection.heroId === id) d.collection.heroId = d.collection.photos[0].id;
                  if (d.collection.secondaryId === id)
                    d.collection.secondaryId = d.collection.photos[0].id;
                });
              },
              'Eliminar diseño',
            ),
          'danger-text',
        );
      return () => {
        if (uploading) throw Error('Esperá a que termine de subir la fotografía.');
        if (!draft.image) throw Error('Elegí una fotografía para el diseño.');
        return {
          photo: {
            ...draft,
            title: title.value,
            alt: alt.value || 'Diseño de uñas: ' + title.value,
            category: category.value,
          },
          main: main.checked,
        };
      };
    },
    async (values) =>
      commit((d) => {
        const index = d.collection.photos.findIndex((p) => p.id === id);
        if (index >= 0) d.collection.photos[index] = values.photo;
        else d.collection.photos.push(values.photo);
        if (values.main) d.collection.heroId = values.photo.id;
      }),
    original ? 'Guardar diseño' : 'Agregar a mi colección',
  );
}
function servicesView() {
  heading(
    'LA CARTA DEL ESTUDIO',
    'Tus servicios.',
    'Los servicios se ofrecen en la agenda y en las consultas. Los grupos de abajo organizan su presentación en la página.',
    (h) => button(h, 'Agregar servicio', () => editService(), 'primary', 'plus'),
  );
  const grid = el('div', undefined, 'service-grid');
  data.booking.services.forEach((s, index) => {
    const card = el('article', undefined, 'service-card');
    card.append(
      el('span', String(index + 1).padStart(2, '0'), 'service-index'),
      el(
        'span',
        s.active ? 'Disponible' : 'Sin reservas',
        'state-pill ' + (s.active ? 'confirmed' : 'cancelled'),
      ),
      el('h2', s.name),
      el('p', s.minutes + ' min', 'service-duration'),
    );
    button(card, 'Editar servicio', () => editService(s.id), 'text-button', 'arrow');
    grid.append(card);
  });
  editor.append(grid);
  const surface = el('section', undefined, 'surface');
  surface.append(
    el('h2', 'Cómo aparecen en tu página'),
    el(
      'p',
      'Cada grupo crea una sección desplegable en la página. Agrupa técnicas y explicaciones; sus horarios y duraciones se configuran por separado en los servicios reservables.',
      'muted',
    ),
  );
  data.studio.services.forEach((s, i) => {
    const row = el('div', undefined, 'settings-row'),
      copy = el('div');
    copy.append(el('h3', s.title), el('p', s.tags.join(' · ')));
    row.append(copy);
    button(row, 'Editar grupo', () => editGroup(i), 'secondary');
    surface.append(row);
  });
  button(surface, 'Agregar grupo', () => editGroup(), 'text-button', 'plus');
  editor.append(surface);
}
function editService(id) {
  const s = data.booking.services.find((s) => s.id === id) || {
    id: randomId(),
    name: '',
    minutes: 60,
    active: true,
  };
  formModal(
    id ? 'Editar servicio' : 'Nuevo servicio',
    'La duración determina qué espacios se ofrecen para reservar.',
    (c) => {
      const name = field(c, 'Nombre del servicio', s.name, { required: true, maxLength: 100 }),
        minutes = field(c, 'Duración en minutos', s.minutes, {
          type: 'number',
          required: true,
          min: 15,
          max: 480,
        }),
        active = toggle(
          c,
          'Disponible para reservar',
          s.active,
          'Apagalo para conservarlo sin ofrecer nuevos turnos.',
        );
      return () => ({
        ...s,
        name: name.value,
        minutes: Number(minutes.value),
        active: active.checked,
      });
    },
    async (value) =>
      commit((d) => {
        const i = d.booking.services.findIndex((s) => s.id === id);
        if (i >= 0) d.booking.services[i] = value;
        else d.booking.services.push(value);
      }),
  );
}
function editGroup(index) {
  const group = data.studio.services[index] || { title: '', description: '', tags: [] };
  formModal(
    index === undefined ? 'Nuevo grupo de servicios' : 'Editar grupo de servicios',
    'El título, las técnicas y la descripción aparecerán en una sección desplegable. Para ofrecer una técnica en la agenda, agregala también como servicio reservable con su duración.',
    (c) => {
      const title = field(c, 'Título del grupo', group.title, { required: true, maxLength: 100 }),
        tags = field(c, 'Técnicas separadas por coma', group.tags.join(', '), { required: true }),
        description = field(c, 'Descripción', group.description, {
          type: 'textarea',
          maxLength: 1000,
        });
      if (index !== undefined && data.studio.services.length > 1)
        button(
          c,
          'Eliminar grupo',
          () =>
            confirmation(
              '¿Quitar este grupo?',
              'Los servicios reservables se conservan.',
              () => commit((d) => d.studio.services.splice(index, 1)),
              'Quitar grupo',
            ),
          'danger-text',
        );
      return () => ({
        ...group,
        title: title.value,
        description: description.value,
        tags: tags.value
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
      });
    },
    async (value) =>
      commit((d) => {
        if (index !== undefined) d.studio.services[index] = value;
        else d.studio.services.push(value);
      }),
  );
}
function hoursView() {
  heading(
    'DISPONIBILIDAD',
    'Tus horarios.',
    'Publicá tus días de atención. La agenda organiza los espacios.',
    (h) => button(h, 'Agregar horario', () => editWindow(), 'primary', 'plus'),
  );
  const summary = el('div', undefined, 'availability-banner');
  summary.classList.toggle('is-paused', !data.booking.enabled);
  summary.append(
    icon('clock'),
    el('div', data.booking.enabled ? 'Tu agenda está abierta' : 'Tu agenda está pausada'),
  );
  button(summary, 'Configurar reservas', bookingSettings, 'secondary');
  editor.append(summary);
  const list = el('section', undefined, 'surface');
  const windows = [...data.booking.windows].sort((a, b) =>
    (a.date + a.start).localeCompare(b.date + b.start),
  );
  if (!windows.length)
    empty(list, 'Abrí tu primer día', 'Agregá una fecha y una franja de atención.');
  windows.forEach((w) => {
    const row = el('div', undefined, 'hours-row'),
      stamp = el('div', undefined, 'day-stamp');
    stamp.append(
      el('strong', w.date.slice(-2)),
      el('small', dateLabel(w.date, { month: 'short' })),
    );
    const copy = el('div', undefined, 'hours-copy');
    copy.append(el('h2', dateLabel(w.date, { weekday: 'long' })), el('p', w.start + ' — ' + w.end));
    row.append(stamp, copy);
    if (w.date < today()) row.append(el('span', 'Pasado', 'muted'));
    button(row, 'Editar horario', () => editWindow(w.id), 'secondary');
    list.append(row);
  });
  editor.append(list);
}
function editWindow(id) {
  const w = data.booking.windows.find((w) => w.id === id) || {
    id: randomId(),
    date: today(),
    start: '09:00',
    end: '18:00',
  };
  formModal(
    id ? 'Editar horario' : 'Nuevo horario',
    'Los turnos ya confirmados conservan su horario.',
    (c) => {
      const date = field(c, 'Día', w.date, { type: 'date', required: true }),
        row = el('div', undefined, 'form-row');
      c.append(row);
      const start = field(row, 'Desde', w.start, { type: 'time', required: true }),
        end = field(row, 'Hasta', w.end, { type: 'time', required: true });
      if (id)
        button(
          c,
          'Retirar esta franja',
          () =>
            confirmation(
              '¿Retirar esta franja?',
              'Se dejarán de ofrecer nuevos turnos en esta franja. Los existentes se conservan.',
              () =>
                commit((d) => {
                  d.booking.windows = d.booking.windows.filter((x) => x.id !== id);
                }),
              'Retirar franja',
            ),
          'danger-text',
        );
      return () => ({ ...w, date: date.value, start: start.value, end: end.value });
    },
    async (value) =>
      commit((d) => {
        const i = d.booking.windows.findIndex((x) => x.id === id);
        if (i >= 0) d.booking.windows[i] = value;
        else d.booking.windows.push(value);
      }),
  );
}
function bookingSettings() {
  formModal(
    'Configuración de reservas',
    'La disponibilidad siempre depende de los días y franjas que publiques.',
    (c) => {
      const enabled = toggle(c, 'Recibir reservas online', data.booking.enabled),
        lead = field(c, 'Anticipación mínima (minutos)', data.booking.minLeadMinutes, {
          type: 'number',
          required: true,
          min: 0,
          max: 10080,
          help: 'Si ponés 120, solo se ofrecen inicios a partir de dos horas después de la consulta. Usá 0 para permitir turnos inmediatos.',
        }),
        buffer = field(c, 'Descanso entre turnos (minutos)', data.booking.bufferMinutes, {
          type: 'number',
          required: true,
          min: 0,
          max: 120,
          help: 'Se suma después de la duración del servicio. Ej.: 60 + 15 minutos bloquean 75 minutos.',
        }),
        limited = toggle(
          c,
          'Limitar cuántos días antes pueden reservar',
          data.booking.maxAdvanceDays > 0,
          'Opcional. Desactivado, se ofrecen todas las fechas que publiques; no se crean días nuevos.',
        ),
        advance = field(c, 'Máximo de días de anticipación', data.booking.maxAdvanceDays || 60, {
          type: 'number',
          required: true,
          min: 1,
          max: 180,
          help: 'Ej.: 30 permite reservar fechas de los próximos 30 días, siempre que hayas publicado sus horarios.',
        });
      advance.disabled = !limited.checked;
      limited.addEventListener('change', () => (advance.disabled = !limited.checked));
      return () => ({
        enabled: enabled.checked,
        minLeadMinutes: Number(lead.value),
        bufferMinutes: Number(buffer.value),
        maxAdvanceDays: limited.checked ? Number(advance.value) : 0,
      });
    },
    async (values) => commit((d) => Object.assign(d.booking, values)),
  );
}
function contentView() {
  heading(
    'TEXTOS E IDENTIDAD',
    'Tu página.',
    'Elegí qué querés cambiar. Te mostramos solo lo necesario.',
  );
  const grid = el('div', undefined, 'settings-grid');
  const groups = [
    [
      'Identidad y contacto',
      'Nombre, redes y formas de encontrarte.',
      'layout',
      () => identityDialog(),
    ],
    [
      'Portada',
      'Las palabras que dan la bienvenida.',
      'spark',
      () => copyDialog('Portada', ['heroLine1', 'heroLine2', 'heroAccent', 'heroDescription']),
    ],
    [
      'Portada · Color',
      'El mensaje que acompaña a los diseños con color.',
      'image',
      () => copyDialog('Portada · Color', ['hero2Line1', 'hero2Line2', 'hero2Accent', 'hero2Description']),
    ],
    [
      'Portada · Detalle',
      'El mensaje sobre los detalles y el nail art.',
      'image',
      () => copyDialog('Portada · Detalle', ['hero3Line1', 'hero3Line2', 'hero3Accent', 'hero3Description']),
    ],
    [
      'Colección',
      'El título que acompaña tus diseños.',
      'image',
      () => copyDialog('Colección', ['collectionLine1', 'collectionLine2']),
    ],
    [
      'Tu estudio',
      'La historia y los pequeños detalles.',
      'home',
      () => copyDialog('Tu estudio', ['studioLine1', 'studioLine2', 'studioLead']),
    ],
    [
      'Contacto',
      'Una invitación a conversar.',
      'users',
      () => copyDialog('Contacto', ['contactLine1', 'contactLine2']),
    ],
  ];
  groups.forEach(([title, desc, ico, action]) => {
    const b = button(grid, title, action, 'settings-card', ico);
    b.append(el('small', desc), el('span', 'Editar ↗', 'edit-hint'));
  });
  editor.append(grid);
  const faq = el('section', undefined, 'surface');
  faq.append(el('h2', 'Preguntas frecuentes'));
  data.faq.forEach((q, i) => {
    const row = el('div', undefined, 'settings-row');
    row.append(el('h3', q.question));
    button(row, 'Editar pregunta', () => faqDialog(i), 'secondary');
    faq.append(row);
  });
  button(faq, 'Agregar pregunta', () => faqDialog(), 'text-button', 'plus');
  editor.append(faq);
}
function identityDialog() {
  formModal(
    'Datos del estudio',
    'Tus datos de contacto y presentación.',
    (c) => {
      const fields = {};
      Object.entries({
        name: 'Nombre del estudio',
        location: 'Ciudad / zona',
        intro: 'Presentación',
        whatsappPhone: 'WhatsApp (598 + ocho dígitos)',
        email: 'Correo',
        instagram: 'Enlace de Instagram',
        facebook: 'Enlace de Facebook',
        whatsappProfile: 'Enlace de WhatsApp',
      }).forEach(
        ([key, label]) =>
          (fields[key] = field(c, label, data.studio[key], {
            type: key === 'intro' ? 'textarea' : 'text',
            maxLength: key === 'intro' ? 2000 : 250,
          })),
      );
      return () =>
        Object.fromEntries(Object.entries(fields).map(([key, input]) => [key, input.value]));
    },
    async (values) => commit((d) => Object.assign(d.studio, values)),
  );
}
const copyNames = {
  heroLine1: 'Portada · primera línea',
  heroLine2: 'Portada · segunda línea',
  heroAccent: 'Portada · palabra destacada',
  heroDescription: 'Portada · descripción',
  hero2Line1: 'Primera línea',
  hero2Line2: 'Segunda línea',
  hero2Accent: 'Palabra destacada',
  hero2Description: 'Descripción',
  hero3Line1: 'Primera línea',
  hero3Line2: 'Segunda línea',
  hero3Accent: 'Palabra destacada',
  hero3Description: 'Descripción',
  collectionLine1: 'Primera línea',
  collectionLine2: 'Segunda línea',
  studioLine1: 'Primera línea',
  studioLine2: 'Segunda línea',
  studioLead: 'Subtítulo',
  contactLine1: 'Primera línea',
  contactLine2: 'Segunda línea',
};
function copyDialog(title, keys) {
  formModal(
    title,
    'Guardá los cambios para actualizar esta sección de tu página.',
    (c) => {
      const inputs = keys.map((key) =>
        field(c, copyNames[key], data.copy[key], {
          type: key.endsWith('Description') ? 'textarea' : 'text',
          maxLength: key.endsWith('Description') ? 600 : 120,
        }),
      );
      return () => Object.fromEntries(keys.map((key, i) => [key, inputs[i].value]));
    },
    async (values) => commit((d) => Object.assign(d.copy, values)),
  );
}
function faqDialog(i) {
  const q = data.faq[i] || { question: '', answer: '' };
  formModal(
    'Pregunta frecuente',
    'Ayudá a resolver las dudas antes de la visita.',
    (c) => {
      const question = field(c, 'Pregunta', q.question, { required: true, maxLength: 200 }),
        answer = field(c, 'Respuesta', q.answer, {
          type: 'textarea',
          required: true,
          maxLength: 1500,
        });
      if (i !== undefined)
        button(
          c,
          'Eliminar pregunta',
          () =>
            confirmation(
              '¿Quitar esta pregunta?',
              'Dejará de aparecer en tu página.',
              () => commit((d) => d.faq.splice(i, 1)),
              'Quitar pregunta',
            ),
          'danger-text',
        );
      return () => ({ question: question.value, answer: answer.value });
    },
    async (value) =>
      commit((d) => {
        if (i !== undefined) d.faq[i] = value;
        else d.faq.push(value);
      }),
  );
}
function locationView() {
  heading('DÓNDE ENCONTRARNOS', 'Tu ubicación', 'La dirección que compartís con tus visitantes.');
  const card = el('section', undefined, 'location-preview');
  card.append(
    icon('pin'),
    el('p', 'EL ESTUDIO', 'eyebrow'),
    el('h2', data.location.address || 'Agregá la dirección de tu estudio'),
    el(
      'span',
      data.location.confirmed ? 'Visible en tu página' : 'Todavía sin mostrar',
      'state-pill ' + (data.location.confirmed ? 'confirmed' : 'cancelled'),
    ),
  );
  button(
    card,
    'Editar ubicación',
    () =>
      formModal(
        'Ubicación del estudio',
        'Usá calle, número y ciudad para orientar a tus visitantes.',
        (c) => {
          const address = field(c, 'Dirección completa', data.location.address, {
              required: true,
              maxLength: 250,
            }),
            confirmed = toggle(c, 'Mostrar esta dirección', data.location.confirmed);
          return () => ({ address: address.value, confirmed: confirmed.checked });
        },
        async (values) => commit((d) => (d.location = values)),
      ),
    'primary',
    'pin',
  );
  if (data.location.address) {
    const a = el('a', 'Ver en Google Maps ↗', 'quiet-link');
    a.href =
      'https://www.google.com/maps/search/?api=1&query=' +
      encodeURIComponent(data.location.address);
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    card.append(a);
  }
  editor.append(card);
}
function accessView() {
  heading('MI MORA', 'Acceso al estudio', 'Administrá tu contraseña e instalá el panel.');
  const grid = el('div', undefined, 'settings-grid');
  const password = el('section', undefined, 'surface');
  password.append(
    icon('lock'),
    el('h2', 'Tu contraseña'),
    el('p', 'Al cambiarla se cierran todas las sesiones.', 'muted'),
  );
  button(
    password,
    'Cambiar contraseña',
    () =>
      formModal(
        'Cambiar contraseña',
        'Elegí una contraseña de al menos 12 caracteres.',
        (c) => {
          const input = field(c, 'Nueva contraseña', '', {
            type: 'password',
            required: true,
            min: undefined,
            maxLength: 128,
            autocomplete: 'new-password',
          });
          input.minLength = 12;
          const repeat = field(c, 'Repetí la contraseña', '', {
            type: 'password',
            required: true,
            autocomplete: 'new-password',
          });
          return () => {
            if (input.value !== repeat.value) throw Error('Las contraseñas no coinciden.');
            return input.value;
          };
        },
        async (value) => {
          await api({ action: 'password', password: value });
          data = null;
          bookings = [];
          editor.replaceChildren();
          $('admin-workspace').hidden = true;
          $('admin-login').hidden = false;
          document.body.classList.remove('is-authenticated');
        },
        'Cambiar y cerrar sesiones',
      ),
    'secondary',
  );
  const install = el('section', undefined, 'surface');
  install.append(
    icon('home'),
    el('h2', 'Siempre a mano'),
    el('p', 'Un icono para abrir tu estudio desde el celular o la computadora.', 'muted'),
  );
  const b = button(
    install,
    'Instalar Mi Mora',
    () => document.dispatchEvent(new Event('bere:install')),
    'primary',
  );
  b.classList.add('install-access');
  grid.append(password, install);
  editor.append(grid);
}
function clientsView() {
  heading(
    'EL HISTORIAL DEL ESTUDIO',
    'Tus clientes.',
    'El historial reúne los turnos registrados con el mismo teléfono.',
  );
  const search = el('label', undefined, 'search-field');
  search.append(icon('search'));
  const input = el('input');
  input.type = 'search';
  input.placeholder = 'Buscar por nombre o celular';
  input.setAttribute('aria-label', 'Buscar clientes');
  input.value = query;
  search.append(input);
  editor.append(search);
  const list = el('div', undefined, 'client-grid');
  editor.append(list);
  function draw() {
    list.replaceChildren();
    const groups = new Map();
    bookings
      .filter((b) => b.phone)
      .forEach((b) => {
        const key = phoneKey(b.phone);
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(b);
      });
    const entries = [...groups.values()]
      .sort((a, b) => Math.max(...b.map((x) => x.created)) - Math.max(...a.map((x) => x.created)))
      .filter((items) =>
        items.some((b) => (b.name + ' ' + b.phone).toLowerCase().includes(query.toLowerCase())),
      );
    if (!entries.length)
      empty(
        list,
        'Cada encuentro deja una historia',
        'Los clientes aparecerán cuando haya reservas registradas.',
        'users',
      );
    entries.forEach((items) => {
      const latest = [...items].sort((a, b) => b.created - a.created)[0],
        card = el('button', undefined, 'client-card');
      card.type = 'button';
      card.append(
        el('span', latest.name[0].toUpperCase(), 'client-avatar'),
        el('strong', latest.name),
        el('small', latest.phone),
        el('span', items.length + ' turnos registrados', 'muted'),
      );
      card.addEventListener('click', () =>
        modal(latest.name, 'Historial de turnos · ' + latest.phone, (c) => {
          items
            .sort((a, b) => b.start - a.start)
            .forEach((b) => {
              const row = el('div', undefined, 'history-row');
              row.append(
                el('p', dateLabel(b.start) + ' · ' + time(b.start)),
                el('h3', b.service),
                el('span', states[b.status], 'state-pill ' + b.status),
              );
              c.append(row);
            });
        }),
      );
      list.append(card);
    });
  }
  input.addEventListener('input', () => {
    query = input.value;
    draw();
  });
  draw();
}
async function refresh() {
  const result = await api();
  data = result.content;
  bookings = result.bookings;
  render();
}
async function load() {
  await refresh();
  $('admin-login').hidden = true;
  $('admin-workspace').hidden = false;
  document.body.classList.add('is-authenticated');
}
$('login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const b = e.submitter;
  b.disabled = true;
  $('login-error').textContent = '';
  try {
    await api({ action: 'login', password: $('admin-password').value });
    $('admin-password').value = '';
    await load();
  } catch (e) {
    $('login-error').textContent = e.message;
  } finally {
    b.disabled = false;
  }
});
$('show-password').addEventListener('click', () => {
  const p = $('admin-password'),
    visible = p.type === 'password';
  p.type = visible ? 'text' : 'password';
  $('show-password').textContent = visible ? 'Ocultar' : 'Ver';
  $('show-password').setAttribute(
    'aria-label',
    visible ? 'Ocultar contraseña' : 'Mostrar contraseña',
  );
});
$('close-editor').addEventListener('click', closeModal);
dialog.addEventListener('cancel', (e) => {
  e.preventDefault();
  closeModal();
});
dialog.addEventListener('click', (e) => {
  if (e.target === dialog) {
    const r = dialog.getBoundingClientRect();
    if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom)
      closeModal();
  }
});
dialog.addEventListener('close', () => {
  modalDirty = false;
});
document.querySelectorAll('[data-tab],[data-route]').forEach((b) => {
  if (b.dataset.icon) b.prepend(icon(b.dataset.icon));
  b.addEventListener('click', () => go(b.dataset.tab || b.dataset.route));
});
$('more-nav').prepend(icon('menu'));
$('more-nav').addEventListener('click', () =>
  modal('Más secciones', 'Elegí la sección que querés abrir.', (c) => {
    const grid = el('nav', undefined, 'more-grid');
    grid.setAttribute('aria-label', 'Más secciones');
    Object.entries(sections).forEach(([key, title]) =>
      button(
        grid,
        title,
        () => {
          dialog.close();
          go(key);
        },
        'secondary',
      ),
    );
    c.append(grid);
  }),
);
$('logout').addEventListener('click', () =>
  confirmation(
    '¿Cerramos por ahora?',
    'Podés volver a entrar con tu contraseña.',
    async () => {
      await api({ action: 'logout' });
      data = null;
      bookings = [];
      editor.replaceChildren();
      $('admin-workspace').hidden = true;
      $('admin-login').hidden = false;
      document.body.classList.remove('is-authenticated');
    },
    'Cerrar sesión',
  ),
);
window.addEventListener('beforeunload', (e) => {
  if (modalDirty) e.preventDefault();
});
setInterval(async () => {
  if (document.hidden || !data || dialog.open || !['home', 'agenda', 'clients'].includes(tab))
    return;
  try {
    const result = await api();
    if (JSON.stringify(result.bookings) !== JSON.stringify(bookings)) {
      bookings = result.bookings;
      render();
    }
  } catch (e) {
    status(e.message, true);
  }
}, 30000);
load().catch((error) => {
  if (!error.message.includes('Iniciá sesión')) $('login-error').textContent = error.message;
});

function manualBookingDialog() {
  let chosenStart = null,
    slotsLoading = false,
    request = 0,
    selectedDate = day;
  const requestKeys = new Map();
  let refreshSlots;
  formModal(
    'Agendá un turno',
    'Elegí un espacio libre de tus horarios publicados. El turno queda confirmado al guardarlo, aunque las reservas online estén pausadas.',
    (c) => {
      const service = select(c, 'Servicio', '', [
        ['', 'Elegí un servicio'],
        ...data.booking.services
          .filter((s) => s.active)
          .map((s) => [s.id, `${s.name} · ${s.minutes} min`]),
      ]);
      service.id = 'manual-service';
      service.required = true;
      const date = select(c, 'Fecha', '', [['', 'Elegí primero un servicio']]);
      date.id = 'manual-date';
      date.required = true;
      date.disabled = true;
      const fieldset = el('fieldset', undefined, 'manual-slot-field');
      fieldset.append(el('legend', 'Horarios disponibles'));
      const hint = el('p', 'Elegí servicio y fecha para ver los espacios libres', 'muted'),
        slots = el('div', undefined, 'manual-booking-slots');
      slots.id = 'manual-slots';
      fieldset.append(hint, slots);
      c.append(fieldset);
      const summary = el('p', undefined, 'manual-booking-summary');
      summary.hidden = true;
      summary.setAttribute('role', 'status');
      c.append(summary);
      const person = el('div', undefined, 'form-row');
      c.append(person);
      const name = field(person, 'Nombre del cliente', '', {
        required: true,
        min: undefined,
        maxLength: 100,
        autocomplete: 'name',
      });
      name.minLength = 2;
      const phone = field(person, 'Celular / WhatsApp', '', {
        type: 'tel',
        required: true,
        maxLength: 25,
        autocomplete: 'tel',
        placeholder: 'Ej.: 099 123 456',
      });
      c.append(
        el(
          'p',
          'El servicio y su descanso quedan ocupados en la misma agenda de la página. No se envían mensajes automáticos al cliente.',
          'manual-booking-note',
        ),
      );
      const ready = () => c.closest('form')?.dispatchEvent(new Event('bere:ready'));
      refreshSlots = async () => {
        const current = ++request;
        chosenStart = null;
        slotsLoading = true;
        summary.hidden = true;
        slots.replaceChildren();
        hint.textContent = 'Buscando espacios libres…';
        ready();
        try {
          const result = await fetch(
            '/api/admin?view=availability&service=' +
              encodeURIComponent(service.value) +
              '&date=' +
              encodeURIComponent(date.value),
            { cache: 'no-store' },
          );
          const availability = await result.json();
          if (!result.ok) {
            const error = Error(availability.error || 'No pudimos consultar los horarios');
            error.status = result.status;
            throw error;
          }
          if (current !== request || !dialog.open || !c.isConnected) return;
          if (!availability.services.some((s) => s.id === service.value)) service.value = '';
          const previous = date.value || selectedDate;
          date.replaceChildren(
            new Option('Elegí una fecha', ''),
            ...availability.dates.map((d) => new Option(dateLabel(d), d)),
          );
          if (availability.dates.includes(previous)) date.value = previous;
          date.disabled = !service.value;
          if (!availability.dates.length) {
            hint.textContent =
              'Todavía no hay horarios publicados. Cargá una franja en Horarios para poder agendar.';
            button(
              slots,
              'Ir a horarios',
              () => {
                closeModal();
                if (!dialog.open) go('hours');
              },
              'text-button',
              'clock',
            );
            return;
          }
          if (!service.value) {
            hint.textContent = 'Elegí el servicio para consultar los horarios';
            return;
          }
          if (!date.value) {
            hint.textContent = 'Elegí una fecha para ver los horarios disponibles';
            return;
          }
          // A date preselected after the first response needs its matching availability.
          if (
            !new URL(result.url).searchParams.get('date') ||
            new URL(result.url).searchParams.get('date') !== date.value
          ) {
            slotsLoading = false;
            await refreshSlots();
            return;
          }
          selectedDate = date.value;
          const selectedService = availability.services.find((s) => s.id === service.value),
            rest = availability.rules.bufferMinutes;
          hint.textContent = availability.slots.length
            ? `Atención: ${selectedService.minutes} min${rest ? ' · descanso posterior: ' + rest + ' min' : ''}. Elegí la hora de inicio.`
            : 'No hay un espacio libre para este servicio en esa fecha. Probá otro día.';
          for (const slot of availability.slots) {
            const choose = button(
              slots,
              slot.time,
              () => {
                chosenStart = slot.start;
                modalDirty = true;
                slots
                  .querySelectorAll('button')
                  .forEach((b) => b.setAttribute('aria-pressed', String(b === choose)));
                summary.textContent = `${slot.time} — ${time(slot.start + selectedService.minutes * 60000)} · ${selectedService.name}${rest ? ' · ' + rest + ' min de descanso' : ''}`;
                summary.hidden = false;
                ready();
              },
              'secondary',
            );
            choose.setAttribute('aria-pressed', 'false');
            choose.dataset.start = String(slot.start);
          }
        } catch (error) {
          if (current !== request || !dialog.open) return;
          hint.textContent = error.message || 'No pudimos consultar los horarios';
          button(slots, 'Reintentar', refreshSlots, 'text-button');
        } finally {
          if (current === request) {
            slotsLoading = false;
            ready();
          }
        }
      };
      service.addEventListener('change', () => {
        date.value = '';
        selectedDate = day;
        void refreshSlots();
      });
      date.addEventListener('change', () => {
        selectedDate = date.value;
        void refreshSlots();
      });
      const read = () => {
        if (!chosenStart || slotsLoading)
          throw Error('Elegí un servicio, una fecha y un horario libre');
        const payload = {
          serviceId: service.value,
          start: chosenStart,
          name: name.value,
          phone: phone.value,
        };
        const signature = JSON.stringify(payload);
        if (!requestKeys.has(signature)) requestKeys.set(signature, randomId());
        return { ...payload, requestKey: requestKeys.get(signature) };
      };
      read.canSubmit = () => !!chosenStart && !slotsLoading;
      queueMicrotask(() => void refreshSlots());
      return read;
    },
    async (payload) => {
      try {
        const result = await api({ action: 'create-booking', ...payload });
        bookings = result.bookings;
        tab = 'agenda';
        day = today(result.booking.start);
        month = day.slice(0, 7);
        filter = 'all';
      } catch (error) {
        if (error.status === 409) {
          await refreshSlots();
          throw Error(
            'Ese espacio ya no está disponible. La lista se actualizó; elegí otro horario.',
          );
        }
        throw error;
      }
    },
    'Agendar turno',
    'Turno agendado y confirmado',
  );
}
