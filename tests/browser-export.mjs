import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, resolve, sep } from "node:path";
import { chromium } from "playwright";

const root = resolve(".");
const mime = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".webmanifest": "application/manifest+json"
};
const server = createServer(async (req, res) => {
  try {
    const pathname = decodeURIComponent(new URL(req.url, "http://127.0.0.1").pathname);
    const path = resolve(root, "." + pathname);
    if (path !== root && !path.startsWith(root + sep)) throw new Error("Invalid path");
    const body = await readFile(path === root ? resolve(root, "index.html") : path);
    res.writeHead(200, { "content-type": mime[extname(path)] || "application/octet-stream" });
    res.end(body);
  } catch {
    res.writeHead(404);
    res.end("Not found");
  }
});

function makeWav(seconds = 3, sampleRate = 48000) {
  const samples = Math.floor(seconds * sampleRate);
  const buffer = Buffer.alloc(44 + samples * 2);
  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(36 + samples * 2, 4);
  buffer.write("WAVE", 8);
  buffer.write("fmt ", 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write("data", 36);
  buffer.writeUInt32LE(samples * 2, 40);
  for (let i = 0; i < samples; i++) {
    const value = Math.sin(2 * Math.PI * 440 * i / sampleRate) * 0.18;
    buffer.writeInt16LE(Math.round(value * 32767), 44 + i * 2);
  }
  return buffer;
}

async function inspectWebm(page, blob) {
  return page.evaluate(async bytes => {
    const video = document.createElement("video");
    video.playsInline = true;
    video.muted = false;
    const url = URL.createObjectURL(new Blob([bytes], { type: "video/webm" }));
    try {
      video.src = url;
      await new Promise((resolve, reject) => {
        video.addEventListener("loadedmetadata", resolve, { once: true });
        video.addEventListener("error", () => reject(new Error("WebM metadata could not be read")), { once: true });
      });
      await video.play();
      await new Promise(resolve => setTimeout(resolve, 250));
      const stream = video.captureStream ? video.captureStream() : null;
      const result = {
        duration: video.duration,
        width: video.videoWidth,
        height: video.videoHeight,
        audioTracks: stream ? stream.getAudioTracks().length : -1
      };
      stream?.getTracks().forEach(track => track.stop());
      video.pause();
      return result;
    } finally {
      video.removeAttribute("src");
      video.load();
      URL.revokeObjectURL(url);
    }
  }, await blob.arrayBuffer());
}

let browser;
try {
  await new Promise(resolve => server.listen(4173, "127.0.0.1", resolve));
  browser = await chromium.launch({ headless: true, args: ["--autoplay-policy=no-user-gesture-required"] });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  page.on("pageerror", error => { throw error; });

  await page.addInitScript(() => {
    localStorage.setItem("bemScenes", JSON.stringify([
      { title: "Browser test — intro", duration: 2, transition: "تلاشي", screenText: "اختبار الفيديو", voice: "هذا اختبار صوتي", visual: "خلفية اختبار", robot: false, graphic: "none" },
      { title: "Browser test — lesson", duration: 2, transition: "انزلاق", screenText: "المشهد الثاني", voice: "نختبر استمرار الصوت", visual: "خلفية اختبار ثانية", robot: false, graphic: "none" }
    ]));
    localStorage.setItem("bemProject", JSON.stringify({ name: "BEM2027 browser QA", subject: "العلوم الطبيعية", title: "اختبار التصدير", ratio: "16:9" }));
  });
  await page.goto("http://127.0.0.1:4173/", { waitUntil: "networkidle" });
  await page.locator("#voiceTrack").setInputFiles({
    name: "qa-tone.wav",
    mimeType: "audio/wav",
    buffer: makeWav(4)
  });
  await page.locator("#renderVideoBtn").click();
  await page.waitForFunction(
    () => document.querySelector("#renderStatus")?.textContent.includes("اكتمل إنشاء الفيديو"),
    { timeout: 30000 }
  );
  const exportInfo = await page.evaluate(async () => {
    const link = document.querySelector("#renderDownload");
    if (link.hidden || !link.href.startsWith("blob:")) throw new Error("WebM download link is missing");
    const blob = await (await fetch(link.href)).blob();
    return { size: blob.size, type: blob.type, bytes: await blob.arrayBuffer() };
  });
  assert.ok(exportInfo.size > 1024, "The rendered WebM must contain data");
  assert.match(exportInfo.type, /video\/webm/);
  const rendered = await inspectWebm(page, { arrayBuffer: async () => exportInfo.bytes });
  assert.ok(rendered.duration >= 3.4 && rendered.duration <= 5.5, `Unexpected rendered duration: ${rendered.duration}`);
  assert.ok(rendered.width >= 1280 && rendered.height >= 720, "Rendered dimensions should be Full HD landscape");
  assert.equal(rendered.audioTracks, 1, "Rendered WebM should retain its voice track");
  console.log("PASS: real studio export produces playable Full HD WebM with an audio track");

  const segmented = await page.evaluate(async () => {
    const canvas = document.createElement("canvas");
    canvas.width = 640;
    canvas.height = 360;
    const ctx = canvas.getContext("2d");
    const canvasStream = canvas.captureStream(24);
    const audioContext = new AudioContext();
    await audioContext.resume();
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    const destination = audioContext.createMediaStreamDestination();
    oscillator.frequency.value = 440;
    gain.gain.value = 0.08;
    oscillator.connect(gain).connect(destination);
    destination.stream.getAudioTracks().forEach(track => canvasStream.addTrack(track));
    oscillator.start();
    let frame = 0;
    let animationId;
    const paint = () => {
      ctx.fillStyle = frame++ % 2 ? "#15172b" : "#25284a";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = "#36d6c5";
      ctx.fillRect((frame * 9) % 600, 150, 40, 40);
      animationId = requestAnimationFrame(paint);
    };
    paint();
    const supported = ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm"]
      .find(type => MediaRecorder.isTypeSupported(type));
    if (!supported) throw new Error("No WebM MediaRecorder MIME type is supported");
    const results = [];
    for (let index = 0; index < 2; index++) {
      const recorder = new MediaRecorder(canvasStream, { mimeType: supported });
      const chunks = [];
      const stopped = new Promise(resolve => recorder.addEventListener("stop", resolve, { once: true }));
      recorder.addEventListener("dataavailable", event => { if (event.data?.size) chunks.push(event.data); });
      recorder.start(200);
      await new Promise(resolve => setTimeout(resolve, 1100));
      recorder.stop();
      await stopped;
      const blob = new Blob(chunks, { type: supported });
      results.push({ type: blob.type, size: blob.size, bytes: await blob.arrayBuffer() });
    }
    cancelAnimationFrame(animationId);
    oscillator.stop();
    canvasStream.getTracks().forEach(track => track.stop());
    await audioContext.close();
    return results;
  });
  assert.equal(segmented.length, 2);
  for (const [index, segment] of segmented.entries()) {
    assert.ok(segment.size > 1024, `Segment ${index + 1} is unexpectedly small`);
    const info = await inspectWebm(page, { arrayBuffer: async () => segment.bytes });
    assert.ok(info.duration >= 0.7 && info.duration <= 1.8, `Segment ${index + 1} duration is invalid: ${info.duration}`);
    assert.equal(info.audioTracks, 1, `Segment ${index + 1} lost its audio track`);
  }
  console.log("PASS: consecutive independent MediaRecorder sessions produce playable WebM segments with continuous-stream audio");

} finally {
  await browser?.close();
  await new Promise(resolve => server.close(resolve));
}
