import { mkdir, copyFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";
const destination = resolve("public/ocr");
await mkdir(destination, { recursive: true });
await copyFile(
  "node_modules/tesseract.js/dist/worker.min.js",
  `${destination}/worker.min.js`,
);
await copyFile(
  "node_modules/tesseract.js/LICENSE.md",
  `${destination}/tesseract-LICENSE.md`,
);
await copyFile(
  "node_modules/tesseract.js-core/LICENSE",
  `${destination}/core-LICENSE`,
);
for (const file of await readdir("node_modules/tesseract.js-core")) {
  if (/-lstm\.wasm(?:\.js)?$/.test(file))
    await copyFile(
      `node_modules/tesseract.js-core/${file}`,
      `${destination}/${file}`,
    );
}
for (const lang of ["eng", "deu"])
  await copyFile(
    `node_modules/@tesseract.js-data/${lang}/4.0.0/${lang}.traineddata.gz`,
    `${destination}/${lang}.traineddata.gz`,
  );
console.log(
  "Prepared same-origin OCR worker, WASM, and English/German language files.",
);
