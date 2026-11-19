(() => {
  const $ = (id) => document.getElementById(id);
  const button = $("renderVideoBtn");
  if (!button) return;

  const setStatus = (message) => { $("renderStatus").textContent = message; };
  let lastWebmBlob = null;
  let ffmpegInstance = null;
  let ffmpegLoadPromise = null;

  const fetchAsBlobURL = async (url, mime) => {
    const response = await fetch(url, { cache: "force-cache" });
    if (!response.ok) throw new Error("تعذر تحميل مكوّن الترميز: HTTP " + response.status);
    return URL.createObjectURL(new Blob([await response.arrayBuffer()], { type: mime }));
  };

  const loadFFmpeg = async () => {
    if (ffmpegInstance) return ffmpegInstance;
    if (ffmpegLoadPromise) return ffmpegLoadPromise;
    ffmpegLoadPromise = (async () => {
      // Use the pinned official ESM build with the browser's native module loader.
      // Do not switch to UMD/webpack: that path caused unresolved blob: module lookups.
      const { FFmpeg } = await import(
        "https://cdn.jsdelivr.net/npm/@ffmpeg/ffmpeg@0.12.15/dist/esm/index.js"
      );
      const coreURLBase = "https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/esm";
      let coreURL = null;
      let wasmURL = null;
      try {
        coreURL = await fetchAsBlobURL(coreURLBase + "/ffmpeg-core.js", "text/javascript");
        wasmURL = await fetchAsBlobURL(coreURLBase + "/ffmpeg-core.wasm", "application/wasm");
        const classWorkerURL = new URL("vendor/ffmpeg/worker.js", document.baseURI).href;
        const ffmpeg = new FFmpeg();
        ffmpeg.on("log", ({ message }) => {
          if (message) {
            console.info("[BEM2027 FFmpeg]", message);
            if (/error|failed|invalid/i.test(message)) setStatus("FFmpeg: " + message.slice(-220));
          }
        });
        await ffmpeg.load({ coreURL, wasmURL, classWorkerURL });
        ffmpegInstance = ffmpeg;
        return ffmpeg;
      } finally {
        if (coreURL) URL.revokeObjectURL(coreURL);
        if (wasmURL) URL.revokeObjectURL(wasmURL);
      }
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
    const previousMp4Url = mp4Link.dataset.objectUrl;
    if (previousMp4Url) URL.revokeObjectURL(previousMp4Url);
    mp4Link.dataset.objectUrl = "";
    let ffmpeg;
    try {
      setStatus("جارٍ تحميل محرك MP4 لأول مرة (حوالي 31 MB). قد يستغرق ذلك بعض الوقت...");
      ffmpeg = await loadFFmpeg();
      setStatus("جارٍ تجهيز ملف الفيديو للتحويل...");
      try { await ffmpeg.deleteFile("bem2027-input.webm"); } catch (_) {}
      try { await ffmpeg.deleteFile("bem2027-output.mp4"); } catch (_) {}
      await ffmpeg.writeFile("bem2027-input.webm", new Uint8Array(await lastWebmBlob.arrayBuffer()));
      setStatus("جارٍ تحويل الفيديو إلى MP4. لا تغلق الصفحة...");
      const exitCode = await ffmpeg.exec([
        "-i", "bem2027-input.webm",
        "-map", "0:v:0", "-map", "0:a?",
        "-c:v", "libx264", "-preset", "ultrafast", "-crf", "24",
        "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "128k",
        "-movflags", "+faststart", "bem2027-output.mp4"
      ]);
      if (exitCode !== 0) throw new Error("انتهى FFmpeg برمز خطأ " + exitCode + ".");
      const output = await ffmpeg.readFile("bem2027-output.mp4");
      const isMp4 = output.length > 12 &&
        String.fromCharCode(...output.subarray(4, 8)) === "ftyp";
      if (!isMp4) throw new Error("الملف الناتج لا يحمل ترويسة MP4 صحيحة.");
      const mp4Blob = new Blob([output], { type: "video/mp4" });
      if (mp4Blob.size < 1024) throw new Error("ملف MP4 الناتج غير صالح أو فارغ.");
      const oldUrl = mp4Link.dataset.objectUrl;
      if (oldUrl) URL.revokeObjectURL(oldUrl);
      const url = URL.createObjectURL(mp4Blob);
      mp4Link.href = url;
      mp4Link.dataset.objectUrl = url;
      mp4Link.download = (JSON.parse(localStorage.getItem("bemProject") || "{}").name || "BEM2027-video").replace(/[^\p{L}\p{N}-]+/gu, "-") + ".mp4";
      mp4Link.hidden = false;
      setStatus("اكتمل التحويل. أصبح ملف MP4 جاهزاً للتحميل.");
      try { await ffmpeg.deleteFile("bem2027-input.webm"); } catch (_) {}
      try { await ffmpeg.deleteFile("bem2027-output.mp4"); } catch (_) {}
    } catch (error) {
      setStatus("تعذر إنشاء MP4: " + (error?.message || String(error)) + " — يمكنك الاحتفاظ بملف WebM.");
    } finally {
      try { await ffmpeg?.deleteFile("bem2027-input.webm"); } catch (_) {}
      try { await ffmpeg?.deleteFile("bem2027-output.mp4"); } catch (_) {}
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
  const resolveGraphic = scene => {
    if (scene.graphic && scene.graphic !== "auto") return scene.graphic;
    if (scene.graphic === "none") return "none";
    const text = [scene.title,scene.screenText,scene.visual].join(" ");
    if (/تاريخ|زمن|مرحلة|سنة|قرن|تسلسل/.test(text)) return "timeline";
    if (/دورة|مراحل|دوران|تكاثر|ماء|تنفس/.test(text)) return "cycle";
    if (/معادلة|هندسة|زاوية|دائرة|مثلث|قطر|محيط|مساحة/.test(text)) return "geometry";
    if (/رسم بياني|إحصاء|نسبة|تزايد|تناقص|دالة|منحنى/.test(text)) return "chart";
    if (/خلية|ذرة|جسم|قلب|جهاز|علوم|طاقة|كهرباء/.test(text)) return "science";
    return "geometry";
  };
  const drawEducationalGraphic = (ctx, kind, elapsed) => {
    if (!kind || kind === "none") return;
    const w=ctx.canvas.width,h=ctx.canvas.height, t=elapsed/1000;
    const cx=w*.31, cy=h*.55, unit=Math.min(w,h)*.19;
    ctx.save(); ctx.translate(cx,cy); ctx.lineCap="round"; ctx.lineJoin="round";
    ctx.shadowColor="#36d6c5"; ctx.shadowBlur=18; ctx.strokeStyle="#36d6c5"; ctx.fillStyle="rgba(54,214,197,.12)"; ctx.lineWidth=Math.max(5,unit*.025);
    const glow="#36d6c5", gold="#ffc857", blue="#45bfff";
    if(kind==="geometry"){
      ctx.strokeStyle=gold; ctx.beginPath(); ctx.moveTo(-unit,-unit*.45); ctx.lineTo(unit,unit*.55); ctx.lineTo(-unit,unit*.55); ctx.closePath(); ctx.stroke();
      ctx.strokeStyle=blue; ctx.beginPath(); ctx.arc(0,0,unit*.63,Math.PI,Math.PI*2); ctx.stroke();
      ctx.fillStyle=glow; ctx.beginPath(); ctx.arc(-unit,unit*.55,unit*.055,0,Math.PI*2); ctx.fill();
      ctx.fillStyle="#fff"; ctx.font="600 "+Math.round(unit*.16)+"px Arial"; ctx.textAlign="center"; ctx.fillText("A",0,-unit*.62); ctx.fillText("B",-unit*.78,unit*.78); ctx.fillText("C",unit*.78,unit*.78);
    } else if(kind==="timeline"){
      ctx.strokeStyle=blue; ctx.beginPath(); ctx.moveTo(-unit*1.25,0); ctx.lineTo(unit*1.25,0); ctx.stroke();
      for(let i=0;i<4;i++){const x=-unit*1.1+i*unit*.73;ctx.fillStyle=i%2?gold:glow;ctx.beginPath();ctx.arc(x,0,unit*.075,0,Math.PI*2);ctx.fill();ctx.strokeStyle=i%2?gold:glow;ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,-unit*(.45+.08*Math.sin(t*2+i)));ctx.stroke();}
      ctx.fillStyle="#fff";ctx.font="600 "+Math.round(unit*.13)+"px Arial";ctx.textAlign="center";["1","2","3","4"].forEach((v,i)=>ctx.fillText(v,-unit*1.1+i*unit*.73,unit*.32));
    } else if(kind==="cycle"){
      for(let i=0;i<3;i++){const a=-Math.PI/2+i*Math.PI*2/3+t*.12,x=Math.cos(a)*unit*.72,y=Math.sin(a)*unit*.58;ctx.fillStyle=i===1?"rgba(255,200,87,.2)":"rgba(54,214,197,.18)";ctx.strokeStyle=i===1?gold:glow;ctx.beginPath();ctx.arc(x,y,unit*.24,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.beginPath();ctx.moveTo(x*.68,y*.68);ctx.lineTo(x*.9,y*.9);ctx.stroke();}
      ctx.strokeStyle=blue;ctx.beginPath();ctx.arc(0,0,unit*1.05,.2,Math.PI*1.85);ctx.stroke();
    } else if(kind==="chart"){
      ctx.strokeStyle="rgba(255,255,255,.55)";ctx.beginPath();ctx.moveTo(-unit*1.15,unit*.75);ctx.lineTo(unit*1.15,unit*.75);ctx.moveTo(-unit*1.15,unit*.75);ctx.lineTo(-unit*1.15,-unit*.8);ctx.stroke();
      ctx.strokeStyle=gold;ctx.beginPath();for(let i=0;i<=40;i++){const x=-unit+i*unit*2/40,y=unit*.45-Math.sin(i/40*Math.PI*1.5)*unit*.95+(i/40)*unit*.2;if(!i)ctx.moveTo(x,y);else ctx.lineTo(x,y);}ctx.stroke();
      ctx.fillStyle=blue;for(let i=0;i<4;i++){ctx.fillRect(-unit*.9+i*unit*.58,unit*.45-i*unit*.23,unit*.25,unit*.3+i*unit*.23);}
    } else if(kind==="science"){
      ctx.strokeStyle=blue;ctx.beginPath();ctx.ellipse(0,0,unit*1.05,unit*.42,.55,0,Math.PI*2);ctx.stroke();ctx.strokeStyle=gold;ctx.beginPath();ctx.ellipse(0,0,unit*1.05,unit*.42,-.55,0,Math.PI*2);ctx.stroke();ctx.fillStyle=glow;ctx.beginPath();ctx.arc(0,0,unit*.13,0,Math.PI*2);ctx.fill();for(let i=0;i<3;i++){const a=t*.8+i*Math.PI*2/3;ctx.fillStyle=i===1?gold:blue;ctx.beginPath();ctx.arc(Math.cos(a)*unit*.88,Math.sin(a)*unit*.35,unit*.08,0,Math.PI*2);ctx.fill();}
    }
    ctx.restore();
  };
  const drawScene = async (ctx, scene, project, index, total, elapsed, image, brandLogo) => {
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
      ctx.save(); ctx.globalAlpha = scene.imageAssetId ? .58 : .25;
      ctx.drawImage(image, (w-iw)/2, (h-ih)/2, iw, ih);
      ctx.restore();
    }
    if (brandLogo) { const scale=Math.min(1,Math.min(110/brandLogo.width,80/brandLogo.height)); ctx.drawImage(brandLogo,90,35,brandLogo.width*scale,brandLogo.height*scale); }
    ctx.direction = "rtl"; ctx.textAlign = "right";
    ctx.fillStyle = "#f5f5ff"; ctx.font = "700 42px Alexandria, Arial";
    ctx.fillText("BEM", w-90, 85);
    ctx.fillStyle = "#36d6c5"; ctx.fillText("2027", w-190, 85);
    const graphicKind = resolveGraphic(scene);
    drawEducationalGraphic(ctx, graphicKind, elapsed);
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
    if (button.disabled) return;
    const saved = JSON.parse(localStorage.getItem("bemScenes") || "null");
    const projectData = JSON.parse(localStorage.getItem("bemProject") || "null");
    const scenes = Array.isArray(saved) ? saved : [];
    if (!scenes.length) { setStatus("أضف مشهداً واحداً على الأقل قبل التصدير."); return; }
    if (!window.MediaRecorder || !HTMLCanvasElement.prototype.captureStream) {
      setStatus("متصفحك لا يدعم تسجيل الفيديو. جرّب أحدث إصدار من Chrome أو Edge.");
      return;
    }

    const ratio = projectData?.ratio || "16:9";
    const [rw, rh] = ratio.split(":").map(Number);
    if (!Number.isFinite(rw) || !Number.isFinite(rh) || rw <= 0 || rh <= 0) {
      setStatus("نسبة أبعاد الفيديو غير صالحة. اختر 16:9 أو 9:16 أو 1:1.");
      return;
    }

    const canvas = document.createElement("canvas");
    if (rw === rh) { canvas.width = 1080; canvas.height = 1080; }
    else if (rw > rh) { canvas.width = 1920; canvas.height = 1080; }
    else { canvas.width = 1080; canvas.height = 1920; }
    const ctx = canvas.getContext("2d");
    if (!ctx) { setStatus("تعذر تهيئة مساحة رسم الفيديو في هذا المتصفح."); return; }

    let stream = null;
    let audioContext = null;
    let audioElement = null;
    let audioUrl = null;
    let recorder = null;
    let recordingDone = null;
    let recorderFailure = null;
    let recordingStarted = false;
    const chunks = [];
    button.disabled = true;
    $("convertMp4Btn").disabled = true;
    $("renderMp4Download").hidden = true;
    $("renderDownload").hidden = true;
    $("renderProgress").value = 0;

    try {
      stream = canvas.captureStream(30);
      const audioFile = $("voiceTrack").files[0];
      if (audioFile) {
        audioContext = new AudioContext();
        audioElement = new Audio();
        audioUrl = URL.createObjectURL(audioFile);
        audioElement.src = audioUrl;
        audioElement.preload = "metadata";
        await new Promise((resolve, reject) => {
          if (audioElement.readyState >= 1) return resolve();
          const onReady = () => { cleanup(); resolve(); };
          const onError = () => { cleanup(); reject(new Error("تعذر قراءة مدة الملف الصوتي أو تحميله.")); };
          const cleanup = () => {
            audioElement.removeEventListener("loadedmetadata", onReady);
            audioElement.removeEventListener("error", onError);
          };
          audioElement.addEventListener("loadedmetadata", onReady, { once: true });
          audioElement.addEventListener("error", onError, { once: true });
          audioElement.load();
        });
        const source = audioContext.createMediaElementSource(audioElement);
        const destination = audioContext.createMediaStreamDestination();
        source.connect(destination);
        destination.stream.getAudioTracks().forEach(track => stream.addTrack(track));
        await audioContext.resume();
      }

      const mime = [
        "video/webm;codecs=vp9,opus",
        "video/webm;codecs=vp8,opus",
        "video/webm"
      ].find(type => MediaRecorder.isTypeSupported(type));
      if (!mime) throw new Error("لم يتوفر ترميز WebM في هذا المتصفح.");

      const brandLogo = await loadImage(localStorage.getItem("bemLogo") || "");
      const durations = scenes.map(scene => Math.max(1, Math.min(300, Number(scene.duration) || 5)) * 1000);
      const totalMs = durations.reduce((sum, duration) => sum + duration, 0);
      if (audioElement && Number.isFinite(audioElement.duration)) {
        const audioMs = audioElement.duration * 1000;
        if (Math.abs(audioMs - totalMs) > 2000) {
          setStatus("تنبيه: مدة التعليق الصوتي (" + Math.round(audioMs / 1000) + " ث) تختلف عن مدة المشاهد (" + Math.round(totalMs / 1000) + " ث). سيتم الحفاظ على توقيت المشاهد وقد ينتهي الصوت مبكراً أو يستمر بعد نهايتها.");
        }
      }

      // Load the first scene before recording so asset loading does not shift the audio/video start.
      let firstSceneImage = await loadImage(scenes[0].image);
      let firstLibraryImageUrl = null;
      if (scenes[0].imageAssetId && window.BEMMedia) {
        const firstAssetBlob = await window.BEMMedia.getBlob(scenes[0].imageAssetId);
        if (firstAssetBlob) {
          firstLibraryImageUrl = URL.createObjectURL(firstAssetBlob);
          firstSceneImage = await loadImage(firstLibraryImageUrl);
        }
      }

      recorder = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 6000000 });
      recordingDone = new Promise(resolve => {
        recorder.addEventListener("stop", resolve, { once: true });
      });
      const recorderFailed = new Promise(resolve => {
        recorder.addEventListener("error", event => {
          recorderFailure = event.error || new Error("حدث خطأ أثناء تسجيل الفيديو.");
          resolve(recorderFailure);
        }, { once: true });
      });
      recorder.addEventListener("dataavailable", event => {
        if (event.data && event.data.size) chunks.push(event.data);
      });
      recorder.start(500);
      recordingStarted = true;
      setStatus("جارٍ إنشاء الفيديو...");

      if (audioElement) {
        audioElement.currentTime = 0;
        try { await audioElement.play(); }
        catch (_) { setStatus("تعذر تشغيل المسار الصوتي؛ سيُنتج الفيديو دون صوت."); }
      }

      let elapsedTotal = 0;
      for (let i = 0; i < scenes.length; i++) {
        const scene = scenes[i];
        const duration = durations[i];
        let libraryImageUrl = null;
        try {
          let image = i === 0 ? firstSceneImage : await loadImage(scene.image);
          if (i === 0) {
            libraryImageUrl = firstLibraryImageUrl;
            firstLibraryImageUrl = null;
          } else if (scene.imageAssetId && window.BEMMedia) {
            const assetBlob = await window.BEMMedia.getBlob(scene.imageAssetId);
            if (assetBlob) {
              libraryImageUrl = URL.createObjectURL(assetBlob);
              image = await loadImage(libraryImageUrl);
            }
          }
          const started = performance.now();
          while (performance.now() - started < duration) {
            const elapsed = performance.now() - started;
            await drawScene(ctx, scene, projectData || {}, i, scenes.length, elapsed, image, brandLogo);
            $("renderProgress").value = Math.min(99, Math.round((elapsedTotal + elapsed) / totalMs * 100));
            setStatus("جارٍ إنشاء المشهد " + (i + 1) + " من " + scenes.length + "...");
            recorderFailure = await Promise.race([
              sleepFrame().then(() => null),
              recorderFailed
            ]);
            if (recorderFailure) throw recorderFailure;
          }
        } finally {
          if (libraryImageUrl) URL.revokeObjectURL(libraryImageUrl);
        }
        elapsedTotal += duration;
      }

      if (audioElement) audioElement.pause();
      recorder.stop();
      recordingStarted = false;
      await recordingDone;
      if (recorderFailure) throw recorderFailure;
      if (!chunks.length) throw new Error("لم ينتج المسجل أي بيانات فيديو.");

      const blob = new Blob(chunks, { type: mime });
      if (blob.size < 1024) throw new Error("ملف WebM الناتج فارغ أو غير مكتمل.");
      lastWebmBlob = blob;

      const oldWebmUrl = $("renderDownload").dataset.objectUrl;
      if (oldWebmUrl) URL.revokeObjectURL(oldWebmUrl);
      const oldMp4Url = $("renderMp4Download").dataset.objectUrl;
      if (oldMp4Url) URL.revokeObjectURL(oldMp4Url);
      $("renderMp4Download").dataset.objectUrl = "";
      const url = URL.createObjectURL(blob);
      const link = $("renderDownload");
      link.href = url;
      link.dataset.objectUrl = url;
      link.download = (projectData?.name || "BEM2027-video").replace(/[^\p{L}\p{N}-]+/gu, "-") + ".webm";
      link.hidden = false;
      link.textContent = "تحميل الفيديو الناتج (WebM)";
      $("renderProgress").value = 100;
      setStatus("اكتمل إنشاء الفيديو. الصيغة الحالية WebM؛ يمكنك الآن طلب تحويله إلى MP4.");
      $("convertMp4Btn").disabled = false;
    } catch (error) {
      setStatus("تعذر إنشاء الفيديو: " + (error?.message || String(error)));
    } finally {
      if (firstLibraryImageUrl) URL.revokeObjectURL(firstLibraryImageUrl);
      if (audioElement) {
        try { audioElement.pause(); audioElement.removeAttribute("src"); audioElement.load(); } catch (_) {}
      }
      if (recordingStarted && recorder && recorder.state !== "inactive") {
        try { recorder.stop(); } catch (_) {}
        if (recordingDone) {
          try { await recordingDone; } catch (_) {}
        }
      }
      if (stream) stream.getTracks().forEach(track => track.stop());
      if (audioContext && audioContext.state !== "closed") {
        try { await audioContext.close(); } catch (_) {}
      }
      if (audioUrl) URL.revokeObjectURL(audioUrl);
      button.disabled = false;
    }
  });
})();