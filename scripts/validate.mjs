import { access, readFile } from "node:fs/promises";
import { constants } from "node:fs";

const required = ["index.html", "styles.css", "app.js", "renderer.js", "README.md", "vendor/ffmpeg/worker.js", "vendor/ffmpeg/const.js", "vendor/ffmpeg/errors.js"];
for (const file of required) {
  await access(file, constants.R_OK);
  console.log("✓", file);
}

const html = await readFile("index.html", "utf8");
for (const script of ["renderer.js", "app.js"]) {
  if (!new RegExp('src="' + script.replace(".", "\\.") + '(?:\\?[^"]*)?"').test(html)) {
    throw new Error("Missing script reference in index.html: " + script);
  }
}
for (const asset of ["styles.css"]) {
  if (!html.includes('href="' + asset + '"')) {
    throw new Error("Missing stylesheet reference in index.html: " + asset);
  }
}
console.log("✓ HTML asset references");

const renderer = await readFile("renderer.js", "utf8");
for (const transition of ["انزلاق", "تكبير", "مسح جانبي", "تلاشي"]) {
  if (!renderer.includes(transition)) {
    throw new Error("Missing renderer transition: " + transition);
  }
}
if (!renderer.includes("canvas.width = 1080") || !renderer.includes("canvas.height = 1080")) {
  throw new Error("Square export dimensions are not configured.");
}
console.log("✓ Scene transitions and square output dimensions");

const mp4Button = html.includes('id="convertMp4Btn"');
const mp4Download = html.includes('id="renderMp4Download"');
if (!mp4Button || !mp4Download) {
  throw new Error("MP4 conversion controls are missing from index.html.");
}
if (!renderer.includes("libx264") || !renderer.includes("bem2027-output.mp4") ||
    !renderer.includes("const exitCode = await ffmpeg.exec") ||
    !renderer.includes('String.fromCharCode(...output.subarray(4, 8)) === "ftyp"')) {
  throw new Error("MP4 conversion must check FFmpeg's exit code and validate the MP4 container signature.");
}
if (!renderer.includes("finally") || !renderer.includes("stream.getTracks().forEach(track => track.stop())") ||
    !renderer.includes("await audioContext.close()") || !renderer.includes("recorderFailure = event.error")) {
  throw new Error("Video export must release media tracks and audio resources on every exit path.");
}
console.log("✓ MP4 conversion UI, H.264 pipeline, exit-code and container validation");

if (!renderer.includes('vendor/ffmpeg/worker.js') || !renderer.includes('@ffmpeg/ffmpeg@0.12.15/dist/esm/index.js') || !renderer.includes('/dist/esm') || !renderer.includes('/ffmpeg-core.js') || !renderer.includes("await ffmpeg.load({ coreURL, wasmURL, classWorkerURL })")) {
  throw new Error("FFmpeg must use the native ESM entry, same-origin worker and ESM core.");
}
if (renderer.includes('dist/umd/ffmpeg.js') || renderer.includes('window.FFmpegWASM')) {
  throw new Error("The FFmpeg UMD/webpack runtime must not be used.");
}
const worker = await readFile("vendor/ffmpeg/worker.js", "utf8");
for (const dependency of ['./const.js', './errors.js']) {
  if (!worker.includes(dependency)) throw new Error("Missing local FFmpeg worker dependency: " + dependency);
}
if (renderer.includes("/814.ffmpeg.js")) {
  throw new Error("The webpack UMD worker chunk must not be used.");
}
if (!renderer.includes('new URL("vendor/ffmpeg/worker.js", document.baseURI)') ||
    !renderer.includes('https://cdn.jsdelivr.net/npm/@ffmpeg/ffmpeg@0.12.15/dist/esm/index.js') ||
    !renderer.includes('https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/esm')) {
  throw new Error("Pinned FFmpeg ESM package URLs or same-origin worker path are missing.");
}
console.log("✓ FFmpeg uses pinned native ESM, same-origin module worker and single-thread ESM core");
