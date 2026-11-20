import { access, readFile } from "node:fs/promises";
import { constants } from "node:fs";

const required = ["index.html", "styles.css", "app.js", "renderer.js", "README.md", "vendor/ffmpeg/worker.js", "vendor/ffmpeg/const.js", "vendor/ffmpeg/errors.js", "sw.js", "manifest.webmanifest", "icons/icon.svg", "media-library.js", "ai-bridge.js"];
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

const bridge = await readFile("ai-bridge.js", "utf8");
if (!bridge.includes("bem2027.video-plan") || !bridge.includes("validatePlan") ||
    !bridge.includes("applyPlan") || !bridge.includes("BEM2027AIStudioBridge")) {
  throw new Error("AI Studio Bridge schema validation or public API is incomplete.");
}
console.log("✓ AI Studio Bridge schema, API and offline cache entry");

const renderer = await readFile("renderer.js", "utf8");
if (!html.includes("الإصدار 1.2.0") || !html.includes("ai-bridge.js?v=1.2.0")) {
  throw new Error("AI Studio Bridge version label or script reference is missing; expected 1.2.0.");
}
if (!html.includes('id="aiPlanInput"') || !html.includes('id="applyAiPlanBtn"') || !html.includes('id="sGraphicData"')) {
  throw new Error("AI Studio Bridge controls are missing from index.html.");
}
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

const app = await readFile("app.js", "utf8");
if (!html.includes('id="presentationBtn"') || !html.includes('id="presentationFile"') ||
    !app.includes('jszip@3.10.1/+esm') || !app.includes("slideFiles") ||
    !app.includes('تم استيراد')) {
  throw new Error("PowerPoint PPTX import controls or slide parser are missing.");
}
console.log("✓ PowerPoint PPTX import controls and slide-to-scene parser");


if (!html.includes('id="pdfBtn"') || !html.includes('id="pdfFile"') ||
    !app.includes('pdfjs-dist@4.10.38/build/pdf.mjs') ||
    !app.includes('pdf.worker.mjs') || !app.includes('page.render') ||
    !app.includes('pdf.numPages > 20')) {
  throw new Error("PDF import controls or page-to-scene rendering are missing.");
}
console.log("✓ PDF import controls and page-to-scene renderer");

const visualApp = await readFile("app.js", "utf8");
if (!visualApp.includes('id="sGraphic"') || !visualApp.includes('s.graphic') ||
    !html.includes('id="brandLogoFile"') || !visualApp.includes('bemLogo')) {
  throw new Error("Educational graphic controls or reusable brand logo upload are missing.");
}
if (!renderer.includes("drawEducationalGraphic") || !renderer.includes("resolveGraphic") ||
    !renderer.includes('scene.graphic') || !renderer.includes('localStorage.getItem("bemLogo")')) {
  throw new Error("Canvas renderer is missing animated educational diagram or brand logo support.");
}
for (const graphic of ["geometry", "timeline", "cycle", "chart", "science", "comparison", "process", "pyramid", "mindmap"]) {
  if (!renderer.includes('kind==="' + graphic + '"')) throw new Error("Missing educational graphic renderer: " + graphic);
}
console.log("✓ Animated educational diagrams, scene graphic selection and reusable brand logo");


const manifest = await readFile("manifest.webmanifest", "utf8");
const sw = await readFile("sw.js", "utf8");
if (!sw.includes("ai-bridge.js?v=1.2.0")) throw new Error("AI Studio Bridge is missing from the PWA offline shell.");
if (!html.includes('rel="manifest"') || !html.includes('navigator.serviceWorker.register') ||
    !manifest.includes('"display": "standalone"') || !manifest.includes('"start_url": "./"') ||
    !sw.includes("CACHE_NAME") || !sw.includes("addAll")) {
  throw new Error("Installable PWA manifest or offline shell registration is incomplete.");
}
if (!html.includes('id="mediaLibraryFile"') || !html.includes('id="mediaLibraryGrid"') ||
    !html.includes('media-library.js?v=1.0.2') || !sw.includes('media-library.js?v=1.0.2')) {
  throw new Error("Reusable media library controls or PWA cache entry are missing.");
}
const mediaLibrary = await readFile("media-library.js", "utf8");
for (const feature of ["indexedDB.open", "bem2027-media-library", "getBlob", "bem-media-selected", "imageAssetId"]) {
  if (!mediaLibrary.includes(feature)) throw new Error("Media library is missing: " + feature);
}
if (!renderer.includes("window.BEMMedia.getBlob(scene.imageAssetId)") ||
    !renderer.includes("URL.revokeObjectURL(libraryImageUrl)") ||
    !renderer.includes("} finally {\n          if (libraryImageUrl) URL.revokeObjectURL(libraryImageUrl);")) {
  throw new Error("Renderer does not load and release reusable library image resources.");
}
if (!mediaLibrary.includes("renderedObjectUrls.forEach(url=>URL.revokeObjectURL(url))") ||
    !mediaLibrary.includes("renderedObjectUrls.push(img.src)")) throw new Error("Media library preview URLs must be released before rerendering.");
const previewApp = await readFile("app.js", "utf8");
if (!previewApp.includes("previewAssetToken") || !previewApp.includes("if (preview.dataset.assetUrl) URL.revokeObjectURL(preview.dataset.assetUrl)") ||
    !previewApp.includes("if (preview.dataset.assetToken === previewToken)")) throw new Error("Preview image URLs and stale asynchronous loads must be cleaned safely.");
if (!renderer.includes('audioElement.preload = "metadata"') ||
    !renderer.includes("audioElement.currentTime = 0") ||
    !renderer.includes("firstSceneImage = await loadImage(scenes[0].image)") ||
    !renderer.includes("Math.abs(audioMs - totalMs) > 2000")) {
  throw new Error("Voice track metadata, first-scene preloading or duration warning is missing.");
}
console.log("✓ Voice metadata validation, first-frame preloading and duration mismatch warning");
console.log("✓ IndexedDB media library, scene linking and renderer asset loading");
console.log("✓ Media object URL cleanup for library, preview and failed scene loads");
console.log("✓ Installable PWA manifest and offline app shell");
