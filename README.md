# Mora Nail Studio

Muestra independiente de un estudio de uñas ficticio, creada por Tomás Fugassa. Incluye colección con visor y filtros, portada con tres mensajes coordinados con las fotografías, frasco 3D con cambio de color y giro, reservas y panel con agenda y editor de contenido. Las siete fotografías se generaron para esta demo: no representan trabajos de clientes. Las consultas no se envían a ningún contacto real.

## Usar localmente

Node 22.16 o posterior. Ejecutar `npm ci` y `npm run dev`, o abrir **VER-DEMO.cmd** después de instalar las dependencias. Web: `http://127.0.0.1:4324/`; panel: `/admin`. La contraseña inicial se genera en `.local-admin-access.txt` y se puede cambiar desde el panel. No compartir ni subir ese archivo.

`npm run check` comprueba el código; `npm run build` compila; `npm run preview` revisa la versión compilada; `npm run qa` comprueba la interfaz con Edge instalado. `scripts/qa-polish.mjs` revisa firma, portada y 3D. Los tests `test-booking.mjs`, `test-schedule.mjs`, `test-manual-booking.mjs` y `test-hero-copy.mjs` usan bases temporales.

Los tres mensajes se editan desde el panel → Textos: Portada, Portada · Color y Portada · Detalle. Se repiten entre las siete imágenes. La firma utiliza Mrs Saint Delafield, alojada en el proyecto. El frasco carga al acercarse a la sección, detiene el render fuera de pantalla y conserva una alternativa si WebGL no está disponible. Las animaciones respetan la preferencia de movimiento reducido.

## Datos y publicación

Astro + TypeScript + CSS + GSAP + Three.js, con backend Node y SQLite. `.mora-data/` contiene datos locales de la demo. Las variables están documentadas en `.env.example`. La dirección queda vacía hasta configurarla desde el panel.

El modo de demostración está activo y los horarios son ficticios. La web incluye `noindex`; eso no restringe el acceso. Antes de compartir una versión alojada, configurar el acceso privado y una contraseña propia del panel; el proyecto trae un servidor de revisión en `scripts/review-server.mjs`. Esta versión no se publica automáticamente ni modifica Railway.

Las siete imágenes de uñas están en `src/assets/mora-*.png`; sus prompts se guardan en `scripts/image-prompts.json` y `scripts/image-prompts-refinement.json`. Se crearon con la herramienta integrada de imágenes. Los fondos de Unsplash son de Brigitte Elsner y Liana S; sus enlaces y créditos están en `scripts/atmosphere-sources.json`.


