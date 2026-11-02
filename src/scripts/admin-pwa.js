export {};
let installPrompt = null;
const standalone = () =>
  matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
function syncInstall() {
  document.querySelectorAll('.install-trigger,.install-access').forEach((button) => {
    button.hidden = standalone();
  });
}
window.addEventListener('beforeinstallprompt', (event) => {
  event.preventDefault();
  installPrompt = event;
});
window.addEventListener('appinstalled', () => {
  installPrompt = null;
  syncInstall();
});
matchMedia('(display-mode: standalone)').addEventListener('change', syncInstall);
function instructions() {
  const dialog = document.getElementById('editor-dialog');
  if (dialog.open) return;
  document.getElementById('dialog-heading').textContent = 'Tu estudio, siempre a mano';
  const body = document.getElementById('dialog-body');
  body.replaceChildren();
  const content = document.createElement('div');
  content.className = 'pwa-instructions';
  const text = document.createElement('p');
  text.textContent = 'Instalá Mi Mora para abrir el panel desde su propio icono.';
  const steps = document.createElement('ol');
  const ios =
    /iphone|ipad|ipod/i.test(navigator.userAgent) ||
    (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1);
  const items = ios
    ? [
        'Abrí esta página en Safari.',
        'Tocá Compartir y elegí «Agregar a inicio».',
        'Confirmá «Agregar» para crear el icono.',
      ]
    : [
        'Abrí esta página en Chrome o Microsoft Edge.',
        'En el menú del navegador, elegí «Instalar Mi Mora» o «Instalar esta página como aplicación». También puede aparecer un icono de instalación junto a la dirección.',
        'Confirmá la instalación y abrí Mi Mora desde su icono.',
      ];
  items.forEach((value) => {
    const li = document.createElement('li');
    li.textContent = value;
    steps.append(li);
  });
  const note = document.createElement('small');
  note.textContent =
    'Necesitás conexión para ver la agenda y guardar cambios. La instalación en el celular estará disponible cuando el sitio tenga su enlace HTTPS. La opción exacta depende del navegador.';
  content.append(text, steps, note);
  body.append(content);
  dialog.showModal();
}
async function install() {
  if (standalone()) return;
  if (installPrompt) {
    const prompt = installPrompt;
    installPrompt = null;
    try {
      await prompt.prompt();
      await prompt.userChoice;
    } catch {
      instructions();
    }
  } else instructions();
}
document.querySelectorAll('.install-trigger').forEach((b) => b.addEventListener('click', install));
document.addEventListener('mora:install', install);
function network() {
  const notice = document.getElementById('offline-notice');
  if (notice) notice.hidden = navigator.onLine;
}
window.addEventListener('online', network);
window.addEventListener('offline', network);
network();
syncInstall();
if ('serviceWorker' in navigator && window.isSecureContext) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/admin-sw.js', { scope: '/admin', updateViaCache: 'none' })
      .catch(() => {
        const message = document.getElementById('admin-status');
        if (message) {
          message.textContent =
            'No se pudo preparar la instalación. Podés seguir usando el panel en el navegador.';
          message.hidden = false;
        }
      });
  });
}
