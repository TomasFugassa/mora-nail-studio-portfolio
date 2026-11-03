import studio from '../../content/studio.json' with { type: 'json' };
import collection from '../../content/collection.json' with { type: 'json' };
import { localDate } from './time.mjs';
export const seedPhotos = collection.photos;
export function createSeed({ demo = true, now = Date.now() } = {}) {
  const windows = [];
  if (demo) for (let i = 1; i <= 8; i++) {
    const day = localDate(now + i * 86400000);
    if (new Date(day + 'T12:00:00Z').getUTCDay() !== 0)
      windows.push({ id: 'demo-'+day, date: day, start: '09:00', end: '18:00' });
  }
  return structuredClone({
      studio,
      collection,
      copy: {
        heroLine1: 'Uñas',
        heroLine2: 'a tu',
        heroAccent: 'manera',
        heroDescription:
          'Explorá la colección, elegí tu diseño y encontrá un espacio en la agenda.',
        collectionLine1: 'De cerca,',
        collectionLine2: 'otro detalle',
        studioLine1: 'El color',
        studioLine2: 'es el comienzo',
        studioLead: 'Una paleta para explorar. Un diseño para hacerlo propio.',
        contactLine1: '¿Tenés una',
        contactLine2: 'idea en mente?',
        ribbon: ['NAIL ART', 'COLOR CON ACTITUD', 'UN POQUITO DE VOS', 'Mora STUDIO'],
      },
      faq: [
        {
          question: '¿Cómo reservo un turno?',
          answer:
            'Elegí servicio, fecha y hora en la agenda. Tu turno se confirma al guardar la reserva. WhatsApp queda disponible para consultas.',
        },
        {
          question: '¿Puedo compartir un diseño?',
          answer:
            'Abrí un diseño de la colección y elegí Usar como inspiración. Podés llevar esa referencia a tu reserva o consulta.',
        },
        {
          question: '¿Cómo cambio o cancelo un turno?',
          answer:
            'Guardá el enlace privado que aparece al reservar. Desde allí podés cancelar; para cambiarlo, consultá al estudio.',
        },
      ],
      location: { address: '', confirmed: false },
      booking: {
        enabled: demo,
        minLeadMinutes: 120,
        bufferMinutes: 15,
        maxAdvanceDays: 60,
        services: [
          { id: 'semi', name: 'Esmaltado semipermanente', minutes: 30, active: true },
          { id: 'kapping', name: 'Kapping', minutes: 60, active: true },
          { id: 'builder', name: 'Builder', minutes: 60, active: true },
          { id: 'softgel', name: 'SoftGel', minutes: 60, active: true },
          { id: 'reconstruccion', name: 'Reconstrucción de uñas', minutes: 60, active: true },
          { id: 'pies', name: 'Estética de pies', minutes: 30, active: true },
          { id: 'podologia', name: 'Podología', minutes: 60, active: true },
          { id: 'nailart', name: 'Nail art y decoraciones', minutes: 30, active: true },
        ],
        windows,
      },
    });
}
