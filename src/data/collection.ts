import type { ImageMetadata } from 'astro';
import content from '../../content/collection.json';
const images = import.meta.glob<{ default: ImageMetadata }>('/src/assets/*.{png,jpg,jpeg,webp}', { eager: true });
const labels: Record<string, string> = { sutil: 'Sutiles', color: 'Con color', arte: 'Nail art' };
const ids = new Set<string>();
export const collection = content.photos.map((photo) => {
  if (!photo.id.trim() || ids.has(photo.id)) throw new Error('Cada diseño necesita un identificador único.');
  ids.add(photo.id);
  const image = images[photo.image]?.default;
  if (!image || !labels[photo.category] || !photo.title.trim() || !photo.alt.trim()) throw new Error(`Revisá foto, categoría, título y descripción del diseño ${photo.id}.`);
  return { ...photo, image, label: labels[photo.category] };
});
const primary = collection.find((photo) => photo.id === content.heroId);
const second = collection.find((photo) => photo.id === content.secondaryId);
if (!primary || !second) throw new Error('Elegí dos diseños existentes para la portada.');
export const hero = primary;
export const secondary = second;
