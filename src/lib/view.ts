import { headingText } from './headings';
import { getImage } from 'astro:assets';
import type { ImageMetadata } from 'astro';
import { getContent, demo } from '../server/store.mjs';
export type Photo = {
    id: string;
    title: string;
    alt: string;
    category: string;
    image: string;
};
export type Site = {
    version: number;
    studio: {
        name: string;
        location: string;
        intro: string;
        email: string;
        whatsappPhone: string;
        instagram: string;
        facebook: string;
        whatsappProfile: string;
        services: {
            number: string;
            title: string;
            tags: string[];
            description: string;
        }[];
    };
    booking: {
        services: {
            name: string;
            active: boolean;
        }[];
    };
    collection: {
        heroId: string;
        secondaryId: string;
        photos: Photo[];
    };
    copy: Record<string, string> & {
        ribbon: string[];
    };
    location: {
        address: string;
        confirmed: boolean;
    };
    faq: {
        question: string;
        answer: string;
    }[];
};
const assets = import.meta.glob<{
    default: ImageMetadata;
}>('/src/assets/*.{png,jpg,jpeg,webp}', {
    eager: true,
});
export async function getView() {
    const content = await getContent() as Site;
    const photos = await Promise.all(content.collection.photos.map(async (photo, index) => {
        const image = assets[photo.image]?.default;
        const large = image
            ? (await getImage({ src: image, width: image.width, format: 'webp', quality: 88 })).src
            : photo.image;
        const thumbnail = image
            ? (await getImage({ src: image, width: 600, format: 'webp', quality: 82 })).src
            : photo.image;
        return {
            ...photo,
            title: headingText(photo.title),
            number: String(index + 1).padStart(2, '0'),
            large,
            thumbnail,
            label: ({ sutil: 'Sutiles', color: 'Con color', arte: 'Nail art' } as Record<string, string>)[photo.category] || 'Diseño',
        };
    }));
    const hero = photos.find((p) => p.id === content.collection.heroId)!, secondary = photos.find((p) => p.id === content.collection.secondaryId)!;
    return {
        ...content,
        copy: {
            ...content.copy,
            ...Object.fromEntries(Object.entries(content.copy)
                .filter(([key]) => !key.endsWith('Description') && key !== 'ribbon')
                .map(([key, value]) => [key, typeof value === 'string' ? headingText(value) : value])),
        },
        photos,
        hero,
        secondary,
        services: content.studio.services.map((service, index) => ({
            ...service,
            title: headingText(service.title),
            number: String(index + 1).padStart(2, '0'),
        })),
        serviceOptions: [
            ...new Set([
                ...content.studio.services.flatMap((s) => s.tags.map((t) => (t === 'Semipermanente' ? 'Esmaltado semipermanente' : t))),
                ...content.booking.services.filter((s) => s.active).map((s) => s.name),
            ].filter((name) => name && name !== 'Necesito orientación')),
            'Necesito orientación',
        ],
        demo,
    };
}
