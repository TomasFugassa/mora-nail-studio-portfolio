import { readFileSync } from 'node:fs';
import { getContent, saveContent, db } from '../src/server/store.mjs';
const previousIntro = 'Una propuesta de estudio donde podés explorar diseños, elegir una técnica y reservar tu próxima visita. Esta marca y sus imágenes forman parte de una demostración de software.';
try {
    const original = await getContent();
    if (!/^mora\b/i.test(original.studio.name))
        throw Error('Esta actualización es solamente para Mora.');
    const content = structuredClone(original);
    const seed = JSON.parse(readFileSync('content/studio.json', 'utf8'));
    if (content.studio.intro === previousIntro)
        content.studio.intro = seed.intro;
    else
        content.studio.intro = content.studio.intro.replace(/\s*Esta marca y sus imágenes forman parte de una demostración de software\./g, '');
    if (content.studio.location === 'Estudio conceptual')
        content.studio.location = '';
    content.collection.photos.forEach(photo => { photo.alt = photo.alt.replace(/\s*Imagen (?:conceptual )?generada para la (?:demostración|muestra)\./g, ''); });
    if (JSON.stringify(content) !== JSON.stringify(original)) {
        await saveContent(content);
        console.log('Textos de presentación actualizados; agenda, accesos y contenido personalizado conservados.');
    }
    else
        console.log('Los textos de presentación ya estaban actualizados.');
}
finally {
    await (await db()).close();
}
