import { access, readFile } from "node:fs/promises";
import { constants } from "node:fs";

const required = ["index.html", "styles.css", "app.js", "renderer.js", "README.md"];
for (const file of required) {
  await access(file, constants.R_OK);
  console.log("✓", file);
}

const html = await readFile("index.html", "utf8");
for (const script of ["renderer.js", "app.js"]) {
  if (!html.includes('src="' + script + '"')) {
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
if (!renderer.includes("libx264") || !renderer.includes("bem2027-output.mp4")) {
  throw new Error("MP4 H.264 conversion pipeline is missing.");
}
console.log("✓ MP4 conversion UI and H.264 pipeline");

if (!renderer.includes("classWorkerURL") || !renderer.includes("/814.ffmpeg.js")) {
  throw new Error("Explicit FFmpeg UMD class worker loading is missing.");
}
console.log("✓ FFmpeg UMD worker is explicitly loaded from the CDN");
