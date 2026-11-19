(() => {
  const $ = (id) => document.getElementById(id);
  const defaults = [
    {title:"مقدمة الفيديو", duration:8, transition:"تلاشي", screenText:"رحلتك نحو التفوق تبدأ من هنا", voice:"مرحباً بكم في مراجعة جديدة من ملخصات BEM2027.", visual:"خلفية مستقبلية داكنة مع ظهور عنوان الفيديو والروبوت.", robot:true},
    {title:"تحديد أهداف الدرس", duration:12, transition:"انزلاق", screenText:"ماذا سنتعلم اليوم؟", voice:"في هذا الفيديو سنكتشف أهم الأفكار بطريقة مبسطة.", visual:"بطاقات تعليمية تظهر بالتتابع مع أيقونات واضحة.", robot:false},
    {title:"شرح الفكرة الأساسية", duration:20, transition:"تكبير", screenText:"الفهم أولاً، ثم التطبيق", voice:"لنبدأ بشرح الفكرة الأساسية خطوة بخطوة.", visual:"مخطط تعليمي واضح مع إبراز المصطلحات المهمة.", robot:true},
    {title:"الخاتمة", duration:8, transition:"تلاشي", screenText:"بالتوفيق في شهادة BEM 2027", voice:"واصلوا المراجعة، وثقتكم بأنفسكم هي بداية النجاح.", visual:"شاشة ختامية تحمل هوية ملخصات BEM2027.", robot:true}
  ];
  let scenes = JSON.parse(localStorage.getItem("bemScenes") || "null") || defaults;
  let current = 0, ratio = "16:9", playing = false, timer = null;

  const save = () => {
    localStorage.setItem("bemScenes", JSON.stringify(scenes));
    localStorage.setItem("bemProject", JSON.stringify({name:$("projectName").value,subject:$("subject").value,title:$("videoTitle").value,ratio}));
    $("saveState").textContent = "● تم الحفظ محلياً";
  };
  const project = () => ({app:"BEM2027 Video Engine",version:"1.0.0",exportedAt:new Date().toISOString(),project:{name:$("projectName").value,subject:$("subject").value,title:$("videoTitle").value,ratio},scenes});
  const renderPreview = () => {
    const s=scenes[current]; if(!s)return;
    $("previewSubject").textContent=$("subject").value;
    $("previewTitle").textContent=s.screenText || s.title;
    $("previewText").textContent=s.voice;
    $("duration").textContent=`00:${String(s.duration).padStart(2,"0")}`;
    $("sceneCount").textContent=`${String(current+1).padStart(2,"0")} / ${String(scenes.length).padStart(2,"0")}`;
    $("progress").style.width=`${((current+1)/scenes.length)*100}%`;
    $("robot").style.display=s.robot && $("robotToggle").checked?"block":"none";
    $("sceneCount").style.visibility=$("numberToggle").checked?"visible":"hidden";
    const preview = $("preview");
    const previewToken = (preview.dataset.assetToken = String(Date.now()) + "-" + current);
    const previewSource = s.image || "";
    if (s.imageAssetId && window.BEMMedia) {
      window.BEMMedia.getBlob(s.imageAssetId).then(blob => {
        if (preview.dataset.assetToken !== previewToken) return;
        if (preview.dataset.assetUrl) URL.revokeObjectURL(preview.dataset.assetUrl);
        preview.dataset.assetUrl = blob ? URL.createObjectURL(blob) : "";
        preview.style.backgroundImage = blob
          ? 'linear-gradient(115deg,rgba(12,14,25,.78),rgba(19,18,42,.72)),url("' + preview.dataset.assetUrl + '")'
          : "";
      }).catch(() => { preview.style.backgroundImage = ""; });
    } else {
      if (preview.dataset.assetUrl) URL.revokeObjectURL(preview.dataset.assetUrl);
      preview.dataset.assetUrl = "";
      preview.style.backgroundImage = previewSource
        ? 'linear-gradient(115deg,rgba(12,14,25,.88),rgba(19,18,42,.82)),url("' + previewSource + '")'
        : "";
    }
    document.querySelectorAll(".preview").forEach(el=>el.style.aspectRatio=ratio.replace(":"," / "));
    renderList();
  };
  const renderList = () => {
    $("sceneList").innerHTML="";
    scenes.forEach((s,i)=>{
      const item=document.createElement("div"); item.className="scene-item"+(i===current?" selected":"");
      item.innerHTML=`<span class="scene-num">${String(i+1).padStart(2,"0")}</span><span class="scene-meta"><b></b><small>${s.duration} ثوانٍ · ${s.transition}</small></span><button title="حذف المشهد" aria-label="حذف المشهد">×</button>`;
      item.querySelector("b").textContent=s.title;
      item.addEventListener("click",()=>{current=i;renderPreview();renderEditor();});
      item.querySelector("button").addEventListener("click",e=>{e.stopPropagation();if(scenes.length===1){alert("يجب أن يحتوي المشروع على مشهد واحد على الأقل.");return;}scenes.splice(i,1);current=Math.min(current,scenes.length-1);save();renderPreview();renderEditor();});
      $("sceneList").appendChild(item);
    });
  };
  const renderEditor = () => {
    const s=scenes[current]; if(!s)return;
    $("editor").innerHTML=`<h3>تعديل المشهد ${String(current+1).padStart(2,"0")}</h3>
      <div class="editor-grid">
      <label>اسم المشهد<input id="sTitle"></label>
      <label>المدة (بالثواني)<input id="sDuration" type="number" min="1" max="300"></label>
      <label>نوع الانتقال<select id="sTransition"><option>تلاشي</option><option>انزلاق</option><option>تكبير</option><option>مسح جانبي</option><option>قطع مباشر</option></select></label>
      <label>الروبوت في هذا المشهد<select id="sRobot"><option value="true">إظهار</option><option value="false">إخفاء</option></select></label>
      <label class="wide">النص الظاهر على الشاشة<textarea id="sScreen"></textarea></label>
      <label class="wide">نص التعليق الصوتي<textarea id="sVoice"></textarea></label>
      <label class="wide">وصف المشهد البصري<textarea id="sVisual"></textarea></label>
      <label class="wide">نوع الرسم التوضيحي<select id="sGraphic"><option value="auto">تلقائي حسب الوصف</option><option value="geometry">هندسة وأشكال</option><option value="timeline">خط زمني</option><option value="cycle">دورة ومراحل</option><option value="chart">مخطط بياني</option><option value="science">علوم</option><option value="none">بدون رسم توضيحي</option></select></label>
      <label class="wide">النص المستخرج من العرض أو PDF<textarea id="sSourceText"></textarea></label>
      <label class="wide">صورة خلفية للمشهد (اختياري)<input class="image-upload" id="sImage" type="file" accept="image/*"></label>
      </div><div class="editor-actions"><button class="btn ghost" id="clearLibraryImage" disabled>إزالة صورة المكتبة</button><button class="btn ghost" id="duplicateScene">نسخ المشهد</button><button class="btn primary" id="applyScene">حفظ تعديلات المشهد</button></div>`;
    $("clearLibraryImage").disabled = !s.imageAssetId;
    $("clearLibraryImage").onclick=()=>{delete s.imageAssetId;save();renderPreview();renderEditor();};
    $("sTitle").value=s.title;$("sDuration").value=s.duration;$("sTransition").value=s.transition;$("sRobot").value=String(!!s.robot);$("sScreen").value=s.screenText;$("sVoice").value=s.voice;$("sVisual").value=s.visual;$("sGraphic").value=s.graphic||"auto";$("sSourceText").value=s.sourceText||"";
    $("sImage").addEventListener("change", async e=>{const file=e.target.files[0];if(!file)return;if(!file.type.startsWith("image/")){alert("يرجى اختيار ملف صورة.");return;}const dataUrl=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsDataURL(file);});const img=new Image();img.onload=()=>{const max=1600,scale=Math.min(1,max/Math.max(img.width,img.height));const canvas=document.createElement("canvas");canvas.width=Math.round(img.width*scale);canvas.height=Math.round(img.height*scale);canvas.getContext("2d").drawImage(img,0,0,canvas.width,canvas.height);s.image=canvas.toDataURL("image/jpeg",0.82);save();alert("تم حفظ صورة المشهد.");};img.onerror=()=>alert("تعذر قراءة الصورة.");img.src=dataUrl;});
    $("applyScene").onclick=()=>{
      s.title=$("sTitle").value.trim()||"مشهد جديد";s.duration=Math.max(1,Math.min(300,Number($("sDuration").value)||1));s.transition=$("sTransition").value;s.robot=$("sRobot").value==="true";s.screenText=$("sScreen").value;s.voice=$("sVoice").value;s.visual=$("sVisual").value;s.graphic=$("sGraphic").value;s.sourceText=$("sSourceText").value;save();renderPreview();renderEditor();
    };
    $("duplicateScene").onclick=()=>{scenes.splice(current+1,0,{...s,title:s.title+" - نسخة"});current++;save();renderPreview();renderEditor();};
  };
  document.querySelectorAll("[data-tab]").forEach(b=>b.addEventListener("click",()=>{
    document.querySelectorAll(".nav").forEach(n=>n.classList.toggle("active",n.dataset.tab===b.dataset.tab));
    document.querySelectorAll(".panel").forEach(p=>p.classList.toggle("active",p.id===b.dataset.tab));
    $("pageTitle").textContent={studio:"استوديو الفيديو",scenes:"إدارة المشاهد",identity:"الهوية البصرية",render:"إنتاج الفيديو"}[b.dataset.tab];
  }));
  ["projectName","subject","videoTitle","robotToggle","numberToggle"].forEach(id=>$(id).addEventListener("change",()=>{save();renderPreview();}));
  $("addScene").onclick=()=>{scenes.push({title:"مشهد جديد",duration:10,transition:"تلاشي",screenText:"اكتب النص الظاهر هنا",voice:"أضف نص التعليق الصوتي.",visual:"صف شكل المشهد والعناصر البصرية.",robot:false});current=scenes.length-1;save();renderPreview();renderEditor();};
  $("prevBtn").onclick=()=>{current=(current-1+scenes.length)%scenes.length;renderPreview();};
  $("nextBtn").onclick=()=>{current=(current+1)%scenes.length;renderPreview();};
  $("playBtn").onclick=()=>{
    if(playing){clearTimeout(timer);playing=false;$("playBtn").textContent="▶ تشغيل المعاينة";return;}
    playing=true;$("playBtn").textContent="Ⅱ إيقاف المعاينة";
    const advance=()=>{
      if(!playing)return;
      timer=setTimeout(()=>{
        current=(current+1)%scenes.length;
        renderPreview();
        advance();
      },Math.max(1000,(Number(scenes[current].duration)||5)*1000));
    };
    advance();
  };
  document.querySelectorAll("[data-ratio]").forEach(b=>b.onclick=()=>{ratio=b.dataset.ratio;document.querySelectorAll("[data-ratio]").forEach(x=>x.classList.toggle("chosen",x===b));renderPreview();save();});
  $("exportBtn").onclick=()=>{const blob=new Blob([JSON.stringify(project(),null,2)],{type:"application/json"});const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download="BEM2027-video-project.json";a.click();URL.revokeObjectURL(a.href);};
  $("importBtn").onclick=()=>$("importFile").click();
  $("importFile").onchange=async e=>{const f=e.target.files[0];if(!f)return;try{const data=JSON.parse(await f.text());if(!Array.isArray(data.scenes)||!data.scenes.length)throw Error("ملف المشروع لا يحتوي على مشاهد صحيحة");scenes=data.scenes;current=0;if(data.project){$("projectName").value=data.project.name||"";$("subject").value=data.project.subject||"العلوم الطبيعية";$("videoTitle").value=data.project.title||"";ratio=data.project.ratio||"16:9";}save();renderPreview();renderEditor();alert("تم استيراد المشروع بنجاح.");}catch(err){alert("تعذر استيراد الملف: "+err.message);}e.target.value="";};

  // PowerPoint importer: converts slide text and the first embedded image into editable scenes.
  const resolveZipPath = (base, target) => {
    const parts = (base + "/" + target).split("/");
    const out = [];
    for (const part of parts) { if (!part || part === ".") continue; if (part === "..") out.pop(); else out.push(part); }
    return out.join("/");
  };
  const blobToDataUrl = blob => new Promise((resolve,reject) => {
    const reader = new FileReader(); reader.onload=()=>resolve(reader.result); reader.onerror=reject; reader.readAsDataURL(blob);
  });
  const optimizeSlideImage = async dataUrl => new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, 1280 / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(img.width * scale));
      canvas.height = Math.max(1, Math.round(img.height * scale));
      canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL("image/jpeg", 0.62));
    };
    img.onerror = () => resolve("");
    img.src = dataUrl;
  });
  $("presentationBtn").onclick = () => $("presentationFile").click();
  $("presentationFile").onchange = async event => {
    const file = event.target.files?.[0];
    if (!file) return;
    const button = $("presentationBtn");
    button.disabled = true;
    button.textContent = "جارٍ استيراد العرض...";
    try {
      if (file.size > 50 * 1024 * 1024) throw new Error("حجم العرض أكبر من 50 ميغابايت.");
      const { default: JSZip } = await import("https://cdn.jsdelivr.net/npm/jszip@3.10.1/+esm");
      const zip = await JSZip.loadAsync(file, { checkCRC32: true });
      const slideFiles = Object.keys(zip.files)
        .filter(name => /^ppt\/slides\/slide\d+\.xml$/.test(name))
        .sort((x,y) => Number(x.match(/slide(\d+)/)[1]) - Number(y.match(/slide(\d+)/)[1]));
      if (!slideFiles.length) throw new Error("لم يتم العثور على شرائح صالحة داخل ملف PPTX.");
      if (slideFiles.length > 20) throw new Error("الإصدار الحالي يستورد حتى 20 شريحة في المرة الواحدة لحماية مساحة التخزين في المتصفح.");
      const imported = [];
      for (let i=0; i<slideFiles.length; i++) {
        const path = slideFiles[i];
        const xmlText = await zip.file(path).async("string");
        const xml = new DOMParser().parseFromString(xmlText, "application/xml");
        if (xml.querySelector("parsererror")) throw new Error("تعذر قراءة الشريحة رقم " + (i+1) + ".");
        const paragraphs = [...xml.getElementsByTagNameNS("*","sp")]
          .map(shape => [...shape.getElementsByTagNameNS("*","t")].map(node => node.textContent.trim()).filter(Boolean).join(" "))
          .filter(Boolean);
        const text = paragraphs.join("\n").trim();
        const relPath = path.replace(/slide(\d+)\.xml$/, "_rels/slide$1.xml.rels");
        let imageData = "";
        const relFile = zip.file(relPath);
        if (relFile) {
          const relXml = new DOMParser().parseFromString(await relFile.async("string"), "application/xml");
          const imageRef = xml.getElementsByTagNameNS("*","blip")[0]?.getAttribute("r:embed") ||
            xml.getElementsByTagNameNS("*","blip")[0]?.getAttributeNS("http://schemas.openxmlformats.org/officeDocument/2006/relationships","embed");
          if (imageRef) {
            const relation = [...relXml.getElementsByTagNameNS("*","Relationship")].find(node => node.getAttribute("Id") === imageRef);
            const target = relation?.getAttribute("Target");
            if (target && !/^https?:/i.test(target)) {
              const imagePath = resolveZipPath("ppt/slides", target);
              const imageFile = zip.file(imagePath);
              if (imageFile) {
                const imageBlob = await imageFile.async("blob");
                imageData = await optimizeSlideImage(await blobToDataUrl(imageBlob));
              }
            }
          }
        }
        const firstLine = (text.split("\n").find(line => line.trim()) || "الشريحة " + (i+1)).slice(0,100);
        imported.push({
          title: "الشريحة " + String(i+1).padStart(2,"0") + " — " + firstLine,
          duration: 8,
          transition: i === 0 ? "تلاشي" : "انزلاق",
          screenText: text || firstLine,
          voice: "",
          visual: "شريحة مستوردة من عرض PowerPoint: " + file.name,
          robot: false,
          ...(imageData ? { image: imageData } : {})
        });
      }
      scenes = imported;
      current = 0;
      $("projectName").value = file.name.replace(/\.pptx$/i,"");
      $("videoTitle").value = file.name.replace(/\.pptx$/i,"");
      save();
      renderPreview();
      renderEditor();
      alert("تم استيراد " + imported.length + " شريحة بنجاح. راجع النصوص والصور ومدد المشاهد قبل التصدير.");
    } catch (error) {
      alert("تعذر استيراد عرض PowerPoint: " + (error?.message || String(error)));
    } finally {
      button.disabled = false;
      button.textContent = "استيراد عرض PPTX";
      event.target.value = "";
    }
  };


  // PDF importer: render each page into an optimized scene image and extract selectable text.
  $("pdfBtn").onclick = () => $("pdfFile").click();
  $("pdfFile").onchange = async event => {
    const file = event.target.files?.[0];
    if (!file) return;
    const button = $("pdfBtn");
    button.disabled = true;
    button.textContent = "جارٍ استيراد PDF...";
    try {
      if (file.size > 40 * 1024 * 1024) throw new Error("حجم ملف PDF أكبر من 40 ميغابايت.");
      const pdfjs = await import("https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.mjs");
      pdfjs.GlobalWorkerOptions.workerSrc = "https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.worker.mjs";
      const bytes = new Uint8Array(await file.arrayBuffer());
      const pdf = await pdfjs.getDocument({ data: bytes, isEvalSupported: false }).promise;
      if (!pdf.numPages) throw new Error("ملف PDF لا يحتوي على صفحات.");
      if (pdf.numPages > 20) throw new Error("الإصدار الحالي يستورد حتى 20 صفحة في المرة الواحدة لحماية ذاكرة المتصفح.");
      const imported = [];
      let totalImageBytes = 0;
      for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
        const page = await pdf.getPage(pageNumber);
        const baseViewport = page.getViewport({ scale: 1 });
        const scale = Math.min(1.5, 1500 / Math.max(baseViewport.width, baseViewport.height));
        const viewport = page.getViewport({ scale });
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.floor(viewport.width));
        canvas.height = Math.max(1, Math.floor(viewport.height));
        const context = canvas.getContext("2d", { alpha: false });
        if (!context) throw new Error("تعذر تجهيز مساحة رسم صفحة PDF رقم " + pageNumber + ".");
        context.fillStyle = "#ffffff";
        context.fillRect(0, 0, canvas.width, canvas.height);
        await page.render({ canvasContext: context, viewport }).promise;
        const image = canvas.toDataURL("image/jpeg", 0.58);
        totalImageBytes += image.length;
        if (totalImageBytes > 3_500_000) throw new Error("الصور الناتجة تجاوزت حد التخزين الآمن. استورد عدداً أقل من الصفحات.");
        const textContent = await page.getTextContent();
        const text = textContent.items
          .filter(item => typeof item.str === "string" && item.str.trim())
          .map(item => item.str.trim())
          .join(" ")
          .trim();
        const heading = (text || "صفحة " + pageNumber).slice(0, 100);
        imported.push({
          title: "صفحة " + String(pageNumber).padStart(2, "0") + " — " + heading,
          duration: 8,
          transition: pageNumber === 1 ? "تلاشي" : "انزلاق",
          screenText: text || "صفحة " + pageNumber,
          voice: "",
          visual: "صفحة مستوردة من ملف PDF: " + file.name,
          robot: false,
          image
        });
        page.cleanup();
        canvas.width = 1;
        canvas.height = 1;
      }
      scenes = imported;
      current = 0;
      $("projectName").value = file.name.replace(/\.pdf$/i, "");
      $("videoTitle").value = file.name.replace(/\.pdf$/i, "");
      save();
      renderPreview();
      renderEditor();
      alert("تم استيراد " + imported.length + " صفحة من PDF وتحويلها إلى مشاهد. راجع النصوص والمدد قبل التصدير.");
      await pdf.destroy();
    } catch (error) {
      alert("تعذر استيراد PDF: " + (error?.message || String(error)));
    } finally {
      button.disabled = false;
      button.textContent = "استيراد PDF";
      event.target.value = "";
    }
  };

  window.addEventListener("bem-media-library-ready", () => renderPreview());
  window.addEventListener("bem-media-selected", event => {
    const assetId = event.detail?.id;
    if (!assetId || !scenes[current]) return;
    scenes[current].imageAssetId = assetId;
    delete scenes[current].image;
    save();
    renderPreview();
    alert("تم ربط الصورة بالمشهد الحالي. ستُحمّل من مكتبة الوسائط عند المعاينة والتصدير.");
  });

  // Brand logo asset: compressed locally and reused by every rendered scene.
  const logoInput = $("brandLogoFile");
  const logoPreview = $("brandLogoPreview");
  const savedLogo = localStorage.getItem("bemLogo") || "";
  if (savedLogo && logoPreview) logoPreview.src = savedLogo;
  if (logoInput) logoInput.addEventListener("change", async event => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) { alert("اختر ملف صورة صالحاً."); event.target.value=""; return; }
    try {
      const dataUrl = await new Promise((resolve,reject) => {
        const reader = new FileReader(); reader.onload=()=>resolve(reader.result); reader.onerror=reject; reader.readAsDataURL(file);
      });
      const img = await new Promise((resolve,reject) => { const image=new Image(); image.onload=()=>resolve(image); image.onerror=reject; image.src=dataUrl; });
      const scale = Math.min(1, 700 / Math.max(img.width,img.height));
      const canvas = document.createElement("canvas"); canvas.width=Math.max(1,Math.round(img.width*scale)); canvas.height=Math.max(1,Math.round(img.height*scale));
      canvas.getContext("2d").drawImage(img,0,0,canvas.width,canvas.height);
      const optimized = canvas.toDataURL("image/png");
      if (optimized.length > 650000) throw new Error("الشعار كبير بعد التحسين. استخدم صورة أصغر من 700 بكسل.");
      localStorage.setItem("bemLogo",optimized);
      if (logoPreview) logoPreview.src=optimized;
      alert("تم حفظ شعار المنصة محلياً وسيظهر في الفيديوهات الجديدة.");
    } catch(error) { alert("تعذر حفظ الشعار: "+(error.message||String(error))); }
    event.target.value="";
  });
  const oldProject=JSON.parse(localStorage.getItem("bemProject")||"null");if(oldProject){$("projectName").value=oldProject.name||$("projectName").value;$("subject").value=oldProject.subject||$("subject").value;$("videoTitle").value=oldProject.title||$("videoTitle").value;ratio=oldProject.ratio||ratio;}
  renderPreview();renderEditor();save();
})();