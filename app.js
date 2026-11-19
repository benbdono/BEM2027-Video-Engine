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
  const project = () => ({app:"BEM2027 Video Engine",version:"0.7.0",exportedAt:new Date().toISOString(),project:{name:$("projectName").value,subject:$("subject").value,title:$("videoTitle").value,ratio},scenes});
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
    $("preview").style.backgroundImage = s.image
      ? 'linear-gradient(115deg,rgba(12,14,25,.88),rgba(19,18,42,.82)),url("' + s.image + '")'
      : "";
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
      <label class="wide">صورة خلفية للمشهد (اختياري)<input class="image-upload" id="sImage" type="file" accept="image/*"></label>
      </div><div class="editor-actions"><button class="btn ghost" id="duplicateScene">نسخ المشهد</button><button class="btn primary" id="applyScene">حفظ تعديلات المشهد</button></div>`;
    $("sTitle").value=s.title;$("sDuration").value=s.duration;$("sTransition").value=s.transition;$("sRobot").value=String(!!s.robot);$("sScreen").value=s.screenText;$("sVoice").value=s.voice;$("sVisual").value=s.visual;
    $("sImage").addEventListener("change", async e=>{const file=e.target.files[0];if(!file)return;if(!file.type.startsWith("image/")){alert("يرجى اختيار ملف صورة.");return;}const dataUrl=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsDataURL(file);});const img=new Image();img.onload=()=>{const max=1600,scale=Math.min(1,max/Math.max(img.width,img.height));const canvas=document.createElement("canvas");canvas.width=Math.round(img.width*scale);canvas.height=Math.round(img.height*scale);canvas.getContext("2d").drawImage(img,0,0,canvas.width,canvas.height);s.image=canvas.toDataURL("image/jpeg",0.82);save();alert("تم حفظ صورة المشهد.");};img.onerror=()=>alert("تعذر قراءة الصورة.");img.src=dataUrl;});
    $("applyScene").onclick=()=>{
      s.title=$("sTitle").value.trim()||"مشهد جديد";s.duration=Math.max(1,Math.min(300,Number($("sDuration").value)||1));s.transition=$("sTransition").value;s.robot=$("sRobot").value==="true";s.screenText=$("sScreen").value;s.voice=$("sVoice").value;s.visual=$("sVisual").value;save();renderPreview();renderEditor();
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
      const scale = Math.min(1, 1600 / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(img.width * scale));
      canvas.height = Math.max(1, Math.round(img.height * scale));
      canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL("image/jpeg", 0.78));
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
      if (file.size > 150 * 1024 * 1024) throw new Error("حجم العرض أكبر من 150 ميغابايت.");
      const { default: JSZip } = await import("https://cdn.jsdelivr.net/npm/jszip@3.10.1/+esm");
      const zip = await JSZip.loadAsync(file, { checkCRC32: true });
      const slideFiles = Object.keys(zip.files)
        .filter(name => /^ppt\/slides\/slide\d+\.xml$/.test(name))
        .sort((x,y) => Number(x.match(/slide(\d+)/)[1]) - Number(y.match(/slide(\d+)/)[1]));
      if (!slideFiles.length) throw new Error("لم يتم العثور على شرائح صالحة داخل ملف PPTX.");
      if (slideFiles.length > 100) throw new Error("العرض يحتوي على أكثر من 100 شريحة. قسّمه إلى عروض أصغر.");
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

  const oldProject=JSON.parse(localStorage.getItem("bemProject")||"null");if(oldProject){$("projectName").value=oldProject.name||$("projectName").value;$("subject").value=oldProject.subject||$("subject").value;$("videoTitle").value=oldProject.title||$("videoTitle").value;ratio=oldProject.ratio||ratio;}
  renderPreview();renderEditor();save();
})();