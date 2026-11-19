(() => {
  const $ = (id) => document.getElementById(id);
  const button = $("renderVideoBtn");
  if (!button) return;

  const setStatus = (message) => { $("renderStatus").textContent = message; };
  let lastWebmBlob = null;
  let ffmpegInstance = null;
  let ffmpegLoadPromise = null;

  const fetchAsBlobURL = async (url, mime) => {
    const response = await fetch(url);
    if (!response.ok) throw new Error("تعذر تحميل مكوّن الترميز: " + response.status);
    return URL.createObjectURL(new Blob([await response.arrayBuffer()], { type: mime }));
  };

  const loadFFmpeg = async () => {
    if (ffmpegInstance) return ffmpegInstance;
    if (ffmpegLoadPromise) return ffmpegLoadPromise;
    ffmpegLoadPromise = (async () => {
      if (!window.FFmpegWASM) {
        await new Promise((resolve, reject) => {
          const script = document.createElement("script");
          script.src = "https://cdn.jsdelivr.net/npm/@ffmpeg/ffmpeg@0.12.15/dist/umd/ffmpeg.js";
          script.crossOrigin = "anonymous";
          script.onload = resolve;
          script.onerror = () => reject(new Error("تعذر تحميل مكتبة FFmpeg من CDN."));
          document.head.appendChild(script);
        });
      }
      if (!window.FFmpegWASM?.FFmpeg) throw new Error("لم يتم العثور على واجهة FFmpeg في المكتبة المحمّلة.");
      const ffmpeg = new window.FFmpegWASM.FFmpeg();
      ffmpeg.on("log", ({ message }) => {
        if (message && /error|failed|invalid/i.test(message)) setStatus("FFmpeg: " + message.slice(-180));
      });
      const baseURL = "https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/umd";
      const [coreURL, wasmURL] = await Promise.all([
        fetchAsBlobURL(baseURL + "/ffmpeg-core.js", "text/javascript"),
        fetchAsBlobURL(baseURL + "/ffmpeg-core.wasm", "application/wasm")
      ]);
      try {
        await ffmpeg.load({ coreURL, wasmURL });
      } finally {
        URL.revokeObjectURL(coreURL);
        URL.revokeObjectURL(wasmURL);
      }
      ffmpegInstance = ffmpeg;
      return ffmpeg;
    })().catch(error => {
      ffmpegLoadPromise = null;
      throw error;
    });
    return ffmpegLoadPromise;
  };

  const convertLastVideoToMp4 = async () => {
    const convertButton = $("convertMp4Btn");
    const mp4Link = $("renderMp4Download");
    if (!lastWebmBlob) {
      setStatus("أنشئ فيديو WebM أولاً، ثم حوّله إلى MP4.");
      return;
    }
    convertButton.disabled = true;
    mp4Link.hidden = true;
    let ffmpeg;
    try {
      setStatus("جارٍ تحميل محرك MP4 لأول مرة (حوالي 31 MB). قد يستغرق ذلك بعض الوقت...");
      ffmpeg = await loadFFmpeg();
      setStatus("جارٍ تجهيز ملف الفيديو للتحويل...");
      await ffmpeg.writeFile("bem2027-input.webm", new Uint8Array(await lastWebmBlob.arrayBuffer()));
      setStatus("جارٍ تحويل الفيديو إلى MP4. لا تغلق الصفحة...");
      await ffmpeg.exec([
        "-i", "bem2027-input.webm",
        "-map", "0:v:0", "-map", "0:a?",
        "-c:v", "libx264", "-preset", "ultrafast", "-crf", "24",
        "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "128k",
        "-movflags", "+faststart", "bem2027-output.mp4"
      ]);
      const output = await ffmpeg.readFile("bem2027-output.mp4");
      const mp4Blob = new Blob([output], { type: "video/mp4" });
      if (mp4Blob.size < 1024) throw new Error("ملف MP4 الناتج غير صالح أو فارغ.");
      const oldUrl = mp4Link.dataset.objectUrl;
      if (oldUrl) URL.revokeObjectURL(oldUrl);
      const url = URL.createObjectURL(mp4Blob);
      mp4Link.href = url;
      mp4Link.dataset.objectUrl = url;
      mp4Link.download = (JSON.parse(localStorage.getItem("bemProject") || "{}").name || "BEM2027-video").replace(/[^a-zA-Z0-9-]+/g, "-") + ".mp4";
      mp4Link.hidden = false;
      setStatus("اكتمل التحويل. أصبح ملف MP4 جاهزاً للتحميل.");
      try { await ffmpeg.deleteFile("bem2027-input.webm"); } catch (_) {}
      try { await ffmpeg.deleteFile("bem2027-output.mp4"); } catch (_) {}
    } catch (error) {
      setStatus("تعذر إنشاء MP4: " + (error?.message || String(error)) + " — يمكنك الاحتفاظ بملف WebM.");
    } finally {
      convertButton.disabled = false;
    }
  };

  $("convertMp4Btn")?.addEventListener("click", convertLastVideoToMp4);
  const sleepFrame = () => new Promise(resolve => requestAnimationFrame(resolve));
  const wrapText = (ctx, text, maxWidth) => {
    const words = String(text || "").split(/\s+/);
    const lines = [];
    let line = "";
    for (const word of words) {
      const test = line ? line + " " + word : word;
      if (line && ctx.measureText(test).width > maxWidth) {
        lines.push(line);
        line = word;
      } else line = test;
    }
    if (line) lines.push(line);
    return lines;
  };
  const roundedRect = (ctx, x, y, w, h, r) => {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
  };
  const drawRobot = (ctx, x, y, scale) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);
    ctx.shadowColor = "#36d6c5";
    ctx.shadowBlur = 28;
    ctx.fillStyle = "#252b49";
    ctx.strokeStyle = "#a6a4ff";
    ctx.lineWidth = 8;
    roundedRect(ctx, 35, 35, 190, 145, 35); ctx.fill(); ctx.stroke();
    ctx.shadowBlur = 15;
    ctx.fillStyle = "#36d6c5";
    ctx.beginPath(); ctx.arc(90, 100, 13, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(170, 100, 13, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#aaa4ff";
    roundedRect(ctx, 104, 135, 52, 8, 4); ctx.fill();
    ctx.strokeStyle = "#8d89e8";
    roundedRect(ctx, 65, 190, 130, 105, 26); ctx.fillStyle = "#202640"; ctx.fill(); ctx.stroke();
    ctx.fillStyle = "#36d6c5"; ctx.beginPath(); ctx.arc(130, 240, 20, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = "#aaa4ff"; ctx.lineWidth = 7;
    ctx.beginPath(); ctx.moveTo(130, 35); ctx.lineTo(130, 8); ctx.stroke();
    ctx.fillStyle = "#36d6c5"; ctx.beginPath(); ctx.arc(130, 5, 10, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  };
  const loadImage = (src) => new Promise(resolve => {
    if (!src) return resolve(null);
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
  const drawScene = async (ctx, scene, project, index, total, elapsed, image) => {
    const w = ctx.canvas.width, h = ctx.canvas.height;
    const motion = elapsed / 1000;
    const phase = Math.min(1, elapsed / 750);
    const transition = scene.transition || "تلاشي";
    ctx.save();
    if (transition === "انزلاق") {
      ctx.translate(-w * (1 - phase), 0);
    } else if (transition === "تكبير") {
      const scale = .88 + .12 * phase;
      ctx.translate(w / 2, h / 2);
      ctx.scale(scale, scale);
      ctx.translate(-w / 2, -h / 2);
    } else if (transition === "مسح جانبي") {
      ctx.beginPath();
      ctx.rect(0, 0, w * phase, h);
      ctx.clip();
    } else if (transition === "تلاشي") {
      ctx.globalAlpha = phase;
    }
    const gradient = ctx.createLinearGradient(0, 0, w, h);
    gradient.addColorStop(0, "#101421");
    gradient.addColorStop(.58, "#211d43");
    gradient.addColorStop(1, "#10343b");
    ctx.fillStyle = gradient; ctx.fillRect(0, 0, w, h);
    const glow = ctx.createRadialGradient(w*.72, h*.45, 10, w*.72, h*.45, w*.45);
    glow.addColorStop(0, "rgba(118,108,255,.28)");
    glow.addColorStop(1, "rgba(118,108,255,0)");
    ctx.fillStyle = glow; ctx.fillRect(0, 0, w, h);
    if (image) {
      const scale = Math.max(w / image.width, h / image.height);
      const iw = image.width * scale, ih = image.height * scale;
      ctx.save(); ctx.globalAlpha = .25;
      ctx.drawImage(image, (w-iw)/2, (h-ih)/2, iw, ih);
      ctx.restore();
    }
    ctx.direction = "rtl"; ctx.textAlign = "right";
    ctx.fillStyle = "#f5f5ff"; ctx.font = "700 42px Alexandria, Arial";
    ctx.fillText("BEM", w-90, 85);
    ctx.fillStyle = "#36d6c5"; ctx.fillText("2027", w-190, 85);
    const showRobot = scene.robot !== false;
    if (showRobot) drawRobot(ctx, w*.12, h*.34 + Math.sin(motion*2)*12, Math.min(w,h)*.00115);
    const title = scene.screenText || scene.title || "";
    ctx.fillStyle = "#36d6c5"; ctx.font = "600 32px Alexandria, Arial";
    ctx.fillText(project.subject || "ملخصات BEM2027", w-100, h*.34);
    ctx.fillStyle = "#ffffff"; ctx.font = "800 68px Alexandria, Arial";
    const titleLines = wrapText(ctx, title, w*.57).slice(0,3);
    titleLines.forEach((line,i) => ctx.fillText(line, w-100, h*.46 + i*92));
    ctx.fillStyle = "#c8cbe0"; ctx.font = "400 30px Alexandria, Arial";
    const voiceLines = wrapText(ctx, scene.voice || "", w*.56).slice(0,2);
    voiceLines.forEach((line,i) => ctx.fillText(line, w-100, h*.78 + i*44));
    ctx.fillStyle = "rgba(255,255,255,.16)";
    roundedRect(ctx, 90, h-75, w-180, 5, 3); ctx.fill();
    ctx.fillStyle = "#36d6c5";
    roundedRect(ctx, 90, h-75, (w-180)*(index+1)/total, 5, 3); ctx.fill();
    ctx.fillStyle = "#aeb3ca"; ctx.font = "24px Alexandria, Arial";
    ctx.textAlign = "left"; ctx.fillText("ملخصات BEM2027", 90, h-95);
    ctx.textAlign = "right"; ctx.fillText(String(index+1).padStart(2,"0")+" / "+String(total).padStart(2,"0"), w-90, h-95);
    ctx.restore();
  };

  button.addEventListener("click", async () => {
    const saved = JSON.parse(localStorage.getItem("bemScenes") || "null");
    const projectData = JSON.parse(localStorage.getItem("bemProject") || "null");
    const scenes = saved || [];
    if (!scenes.length) { setStatus("أضف مشهداً واحداً على الأقل قبل التصدير."); return; }
    if (!window.MediaRecorder || !HTMLCanvasElement.prototype.captureStream) {
      setStatus("متصفحك لا يدعم تسجيل الفيديو. جرّب أحدث إصدار من Chrome أو Edge.");
      return;
    }
    const ratio = projectData?.ratio || "16:9";
    const [rw,rh] = ratio.split(":").map(Number);
    const canvas = document.createElement("canvas");
    if (rw === rh) {
      canvas.width = 1080;
      canvas.height = 1080;
    } else if (rw > rh) {
      canvas.width = 1920;
      canvas.height = 1080;
    } else {
      canvas.width = 1080;
      canvas.height = 1920;
    }
    const ctx = canvas.getContext("2d");
    const stream = canvas.captureStream(30);
    let audioContext, audioElement, audioUrl;
    const audioFile = $("voiceTrack").files[0];
    if (audioFile) {
      try {
        audioContext = new AudioContext();
        audioElement = new Audio();
        audioUrl = URL.createObjectURL(audioFile);
        audioElement.src = audioUrl;
        audioElement.preload = "auto";
        const source = audioContext.createMediaElementSource(audioElement);
        const destination = audioContext.createMediaStreamDestination();
        source.connect(destination);
        source.connect(audioContext.destination);
        destination.stream.getAudioTracks().forEach(track => stream.addTrack(track));
        await audioContext.resume();
      } catch (error) {
        setStatus("تعذر تجهيز المسار الصوتي: " + error.message);
        return;
      }
    }
    const mime = ["video/webm;codecs=vp9,opus","video/webm;codecs=vp8,opus","video/webm"].find(t=>MediaRecorder.isTypeSupported(t));
    if (!mime) { setStatus("لم يتوفر ترميز WebM في هذا المتصفح."); return; }
    const chunks = [];
    let recorder;
    try { recorder = new MediaRecorder(stream,{mimeType:mime,videoBitsPerSecond:6000000}); }
    catch (error) { setStatus("تعذر بدء التصدير: "+error.message); return; }
    recorder.ondataavailable = e => { if(e.data.size) chunks.push(e.data); };
    recorder.onerror = e => setStatus("حدث خطأ أثناء التسجيل: "+(e.error?.message || "غير معروف"));
    const done = new Promise(resolve => recorder.onstop = resolve);
    button.disabled = true;
    $("renderProgress").value = 0;
    $("renderDownload").hidden = true;
    setStatus("جارٍ تجهيز المشاهد...");
    recorder.start(500);
    if (audioElement) { try { await audioElement.play(); } catch(e) { setStatus("تعذر تشغيل الملف الصوتي؛ سيُنتج الفيديو دون صوت."); } }
    const totalMs = scenes.reduce((sum,s)=>sum+Math.max(1,Number(s.duration)||5)*1000,0);
    let elapsedTotal = 0;
    for (let i=0;i<scenes.length;i++) {
      const scene = scenes[i];
      const duration = Math.max(1,Math.min(300,Number(scene.duration)||5))*1000;
      const image = await loadImage(scene.image);
      const started = performance.now();
      while (performance.now()-started < duration) {
        const elapsed = performance.now()-started;
        await drawScene(ctx,scene,projectData||{},i,scenes.length,elapsed,image);
        $("renderProgress").value = Math.min(100,Math.round((elapsedTotal+elapsed)/totalMs*100));
        setStatus("جارٍ إنشاء المشهد "+(i+1)+" من "+scenes.length+"...");
        await sleepFrame();
      }
      elapsedTotal += duration;
    }
    if (audioElement) audioElement.pause();
    recorder.stop();
    await done;
    const blob = new Blob(chunks,{type:mime});
    lastWebmBlob = blob;
    $("convertMp4Btn").disabled = false;
    $("renderMp4Download").hidden = true;
    const url = URL.createObjectURL(blob);
    const link = $("renderDownload");
    link.href = url;
    link.download = (projectData?.name || "BEM2027-video").replace(/[^\p{L}\p{N}-]+/gu,"-")+".webm";
    link.hidden = false;
    link.textContent = "تحميل الفيديو الناتج (WebM)";
    $("renderProgress").value = 100;
    setStatus("اكتمل إنشاء الفيديو. الصيغة الحالية WebM وليست MP4.");
    button.disabled = false;
    stream.getTracks().forEach(t=>t.stop());
    if (audioContext) await audioContext.close();
    if (audioUrl) URL.revokeObjectURL(audioUrl);
  });
})();