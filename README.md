# Mora Nail Studio

Muestra de un estudio de uñas: colección, frasco 3D, servicios, reservas y panel de administración. Astro, TypeScript, GSAP, Three.js y SQLite. Las animaciones funcionan desde la dirección normal, sin parámetros adicionales.

## Abrir

Con Node 22.16 o posterior:

```sh
npm ci
npm run dev
```

- Web: http://127.0.0.1:4324/
- Panel: http://127.0.0.1:4324/admin
- También podés abrir **VER-DEMO.cmd** después de instalar las dependencias.
- La contraseña inicial del panel se genera en `.local-admin-access.txt`; después se cambia desde el panel.

Para verla desde el celular en el mismo router, abrí **VER-EN-CELULAR.cmd** o ejecutá `npm run dev:lan`. Usá la dirección **Network** que muestra la consola, seguida de `/admin` para el panel.

## Conservar y comprobar

- `npm run check`: revisar el código. `npm run build`: generar la versión compilada.
- Datos locales: `.bere-data/`. No se suben a GitHub las bases, contraseñas, sesiones ni archivos `.env`.
- Los horarios son de prueba. WhatsApp prepara consultas al **095 983 487** sin enviarlas automáticamente.
- Imágenes de uñas generadas para la muestra. Créditos de los fondos en `scripts/atmosphere-sources.json`.

El repositorio guarda el código. No hay alojamiento ni despliegue automático configurado; estas direcciones solo funcionan en tu computadora o red local.
