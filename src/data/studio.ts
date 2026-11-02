import content from '../../content/studio.json';
for (const field of ['instagram', 'facebook', 'whatsappProfile'] as const) {
  if (new URL(content[field]).protocol !== 'https:') throw new Error(`Contacto inválido: ${field}`);
}
if (!/^598\d{8}$/.test(content.whatsappPhone)) throw new Error('WhatsApp debe tener formato internacional uruguayo, sin espacios.');
if (!content.services.length || content.services.some((service) => !service.title.trim() || !service.tags.length || !service.description.trim())) throw new Error('Completá título, opciones y descripción de cada servicio.');
export const studio = { ...content, address: null, hours: null, pilot: true };
export const services = content.services;
export const serviceOptions = [...new Set(services.flatMap((service) => service.tags.map((tag) => tag === 'Semipermanente' ? 'Esmaltado semipermanente' : tag))), 'Necesito orientación'];
