import { cp, mkdir, rm } from 'node:fs/promises';

await rm('dist', { recursive: true, force: true });
await mkdir('dist/src', { recursive: true });
await cp('index.html', 'dist/index.html');
await cp('styles.css', 'dist/styles.css');
await cp('src/app.js', 'dist/src/app.js');
await cp('src/engine.js', 'dist/src/engine.js');
await cp('src/sample.js', 'dist/src/sample.js');
console.log('Built static ThreadAtlas bundle in dist/');
