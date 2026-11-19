(() => {
  const DB_NAME = "bem2027-media-library";
  const STORE = "assets";
  const $ = id => document.getElementById(id);
  const input = $("mediaLibraryFile");
  const grid = $("mediaLibraryGrid");
  const status = $("mediaLibraryStatus");
  if (!input || !grid) return;
  let dbPromise;
  const openDB = () => {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve,reject) => {
      const request = indexedDB.open(DB_NAME,1);
      request.onupgradeneeded = () => {
        const db=request.result;
        if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE,{keyPath:"id"});
      };
      request.onsuccess=()=>resolve(request.result);
      request.onerror=()=>reject(request.error || new Error("تعذر فتح قاعدة مكتبة الوسائط."));
    });
    return dbPromise;
  };
  const transaction = async (mode, action) => {
    const db=await openDB();
    return new Promise((resolve,reject) => {
      const tx=db.transaction(STORE,mode), store=tx.objectStore(STORE);
      let result;
      try { result=action(store); } catch(error) { reject(error); return; }
      tx.oncomplete=()=>resolve(result?.result);
      tx.onerror=()=>reject(tx.error || new Error("فشلت عملية مكتبة الوسائط."));
      tx.onabort=()=>reject(tx.error || new Error("أُلغيت عملية مكتبة الوسائط."));
    });
  };
  const getAll = async () => {
    const db=await openDB();
    return new Promise((resolve,reject)=>{
      const req=db.transaction(STORE,"readonly").objectStore(STORE).getAll();
      req.onsuccess=()=>resolve(req.result || []);
      req.onerror=()=>reject(req.error);
    });
  };
  const getBlob = async id => {
    const db=await openDB();
    return new Promise((resolve,reject)=>{
      const req=db.transaction(STORE,"readonly").objectStore(STORE).get(id);
      req.onsuccess=()=>resolve(req.result?.blob || null);
      req.onerror=()=>reject(req.error);
    });
  };
  window.BEMMedia = {getBlob};
  const optimize = file => new Promise((resolve,reject)=>{
    const url=URL.createObjectURL(file), img=new Image();
    img.onload=()=>{
      URL.revokeObjectURL(url);
      const scale=Math.min(1,1600/Math.max(img.width,img.height));
      const canvas=document.createElement("canvas");
      canvas.width=Math.max(1,Math.round(img.width*scale));
      canvas.height=Math.max(1,Math.round(img.height*scale));
      const ctx=canvas.getContext("2d");
      if(!ctx){reject(new Error("تعذر تهيئة معالجة الصور."));return;}
      ctx.drawImage(img,0,0,canvas.width,canvas.height);
      canvas.toBlob(blob=>blob?resolve(blob):reject(new Error("تعذر ضغط الصورة.")),"image/jpeg",.82);
    };
    img.onerror=()=>{URL.revokeObjectURL(url);reject(new Error("ملف الصورة غير صالح أو لا يمكن قراءته."));};
    img.src=url;
  });
  const formatSize = bytes => bytes < 1024*1024 ? Math.round(bytes/1024)+" KB" : (bytes/1024/1024).toFixed(1)+" MB";
  const render = async () => {
    try {
      const assets=await getAll();
      grid.replaceChildren();
      if(!assets.length){grid.innerHTML='<p class="render-help">المكتبة فارغة. أضف صوراً للبدء.</p>';return;}
      assets.sort((a,b)=>b.createdAt-a.createdAt);
      for(const asset of assets){
        const card=document.createElement("article");card.className="media-asset";
        const img=document.createElement("img");img.alt=asset.name;img.src=URL.createObjectURL(asset.blob);
        const title=document.createElement("strong");title.textContent=asset.name;
        const size=document.createElement("small");size.className="media-size";size.textContent=formatSize(asset.blob.size);
        const actions=document.createElement("div");actions.className="media-asset-actions";
        const use=document.createElement("button");use.className="btn primary";use.type="button";use.textContent="استخدام";
        use.addEventListener("click",()=>window.dispatchEvent(new CustomEvent("bem-media-selected",{detail:{id:asset.id}})));
        const remove=document.createElement("button");remove.className="btn ghost";remove.type="button";remove.textContent="حذف";
        remove.addEventListener("click",async()=>{
          const scenes=JSON.parse(localStorage.getItem("bemScenes")||"[]");
          if(scenes.some(scene=>scene.imageAssetId===asset.id)){alert("هذه الصورة مستخدمة في مشهد. أزل ارتباطها بالمشهد أولاً قبل حذفها.");return;}
          if(!confirm("حذف هذه الصورة نهائياً من مكتبة هذا المتصفح؟"))return;
          await transaction("readwrite",store=>store.delete(asset.id));render();
        });
        actions.append(use,remove);card.append(img,title,size,actions);grid.append(card);
      }
    } catch(error){grid.textContent="تعذر تحميل المكتبة: "+(error.message||String(error));}
  };
  input.addEventListener("change",async()=>{
    const files=[...input.files||[]];if(!files.length)return;
    input.disabled=true;
    let added=0;
    try{
      for(const file of files){
        if(!file.type.startsWith("image/"))continue;
        if(file.size>15*1024*1024)throw new Error("الصورة "+file.name+" أكبر من 15 ميغابايت.");
        const blob=await optimize(file);
        const id=crypto.randomUUID?crypto.randomUUID():"asset-"+Date.now()+"-"+Math.random().toString(16).slice(2);
        await transaction("readwrite",store=>store.put({id,name:file.name.slice(0,100),blob,createdAt:Date.now()}));
        added++;
      }
      status.textContent="تمت إضافة "+added+" صورة إلى المكتبة.";
      await render();
    }catch(error){status.textContent="تعذر إكمال الإضافة: "+(error.message||String(error));}
    finally{input.disabled=false;input.value="";}
  });
  render();
})();