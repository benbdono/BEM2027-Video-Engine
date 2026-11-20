(() => {
  "use strict";
  const $ = id => document.getElementById(id);
  const schema = "bem2027.video-plan";
  const transitions = new Set(["تلاشي", "انزلاق", "تكبير", "مسح جانبي", "قطع مباشر"]);
  const graphics = new Set(["auto", "geometry", "timeline", "cycle", "chart", "science", "none"]);
  const ratios = new Set(["16:9", "9:16", "1:1"]);
  const limits = { title: 160, screenText: 1200, voice: 4000, visual: 1200, sourceText: 8000 };
  const fail = message => { throw new Error(message); };
  const cleanText = (value, field, max) => {
    if (value == null) return "";
    if (typeof value !== "string") fail("الحقل " + field + " يجب أن يكون نصاً.");
    const text = value.trim();
    if (text.length > max) fail("الحقل " + field + " تجاوز الحد المسموح.");
    return text;
  };
  const validatePlan = input => {
    if (!input || typeof input !== "object" || Array.isArray(input)) fail("الخطة يجب أن تكون كائن JSON.");
    if (input.schema !== schema || input.version !== 1) fail("صيغة الخطة غير معروفة. استخدم bem2027.video-plan بإصدار 1.");
    if (!input.project || typeof input.project !== "object" || Array.isArray(input.project)) fail("بيانات المشروع غير صالحة.");
    if (!Array.isArray(input.scenes) || input.scenes.length < 1 || input.scenes.length > 80) fail("يجب أن تحتوي الخطة على مشهد واحد إلى 80 مشهداً.");
    const project = {
      name: cleanText(input.project.name || "مشروع BEM2027", "اسم المشروع", 120),
      subject: cleanText(input.project.subject || "العلوم الطبيعية", "المادة", 80),
      title: cleanText(input.project.title || "", "عنوان الفيديو", 180),
      ratio: input.project.ratio || "16:9"
    };
    if (!ratios.has(project.ratio)) fail("نسبة الفيديو يجب أن تكون 16:9 أو 9:16 أو 1:1.");
    const scenes = input.scenes.map((scene, index) => {
      if (!scene || typeof scene !== "object" || Array.isArray(scene)) fail("بيانات المشهد " + (index + 1) + " غير صالحة.");
      const duration = Number(scene.duration);
      if (!Number.isInteger(duration) || duration < 1 || duration > 300) fail("مدة المشهد " + (index + 1) + " يجب أن تكون بين 1 و300 ثانية.");
      const transition = scene.transition || "تلاشي";
      const graphic = scene.graphic || "auto";
      if (!transitions.has(transition)) fail("انتقال غير مدعوم في المشهد " + (index + 1) + ".");
      if (!graphics.has(graphic)) fail("نوع رسم غير مدعوم في المشهد " + (index + 1) + ".");
      if (scene.image || scene.imageAssetId || scene.audio || scene.audioUrl) fail("لا تضع الصور أو الصوت داخل JSON. أضفها من مكتبة الوسائط وواجهة الصوت.");
      return {
        title: cleanText(scene.title || ("مشهد " + (index + 1)), "عنوان المشهد", limits.title),
        duration, transition,
        screenText: cleanText(scene.screenText, "النص الظاهر", limits.screenText),
        voice: cleanText(scene.voice, "التعليق الصوتي", limits.voice),
        visual: cleanText(scene.visual, "الوصف البصري", limits.visual),
        sourceText: cleanText(scene.sourceText, "النص المرجعي", limits.sourceText),
        robot: scene.robot === true,
        graphic
      };
    });
    return { schema, version: 1, project, scenes };
  };
  const exportPlan = () => {
    const current = window.BEM2027Editor?.getProject?.();
    if (!current) fail("محرر BEM2027 غير جاهز.");
    return validatePlan({ schema, version: 1, project: current.project, scenes: current.scenes.map(scene => ({
      title: scene.title, duration: Number(scene.duration), transition: scene.transition || "تلاشي",
      screenText: scene.screenText || "", voice: scene.voice || "", visual: scene.visual || "",
      sourceText: scene.sourceText || "", robot: scene.robot === true, graphic: scene.graphic || "auto"
    })) });
  };
  const applyPlan = input => {
    const plan = validatePlan(input);
    if (!window.BEM2027Editor?.loadProject) fail("واجهة محرر BEM2027 غير متاحة.");
    const loaded = window.BEM2027Editor.loadProject({ project: plan.project, scenes: plan.scenes });
    return { schema, version: 1, project: loaded.project, scenes: loaded.scenes };
  };
  const bridge = Object.freeze({ version: "1.1.0", validatePlan, applyPlan, exportPlan,
    getProject: () => window.BEM2027Editor?.getProject?.() || null,
    requestRender: () => { const button = $("renderVideoBtn"); if (!button || button.disabled) fail("زر التصدير غير جاهز."); button.click(); return true; }
  });
  Object.defineProperty(window, "BEM2027AIStudioBridge", { value: bridge, configurable: false, writable: false });
  const status = (message, state) => { const node = $("aiBridgeStatus"); if (node) { node.textContent = message; node.dataset.state = state || ""; } };
  $("applyAiPlanBtn")?.addEventListener("click", () => {
    try {
      const raw = $("aiPlanInput")?.value || "";
      if (!raw.trim()) fail("الصق خطة JSON أولاً.");
      if (raw.length > 1_500_000) fail("حجم الخطة أكبر من 1.5 ميغابايت.");
      const result = applyPlan(JSON.parse(raw));
      status("تم التحقق وتطبيق الخطة: " + result.scenes.length + " مشاهد. راجعها قبل التصدير.", "success");
    } catch (error) { status("لم تُطبّق الخطة: " + (error?.message || String(error)), "error"); }
  });
  $("exportAiPlanBtn")?.addEventListener("click", () => {
    try {
      const plan = exportPlan();
      const blob = new Blob([JSON.stringify(plan, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a"); link.href = url; link.download = "BEM2027-ai-video-plan.json";
      link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
      status("تم تجهيز ملف خطة AI للمشروع الحالي.", "success");
    } catch (error) { status("تعذر تصدير الخطة: " + (error?.message || String(error)), "error"); }
  });
  window.addEventListener("message", event => {
    if (event.origin !== window.location.origin || event.data?.type !== "BEM2027_AI_PLAN") return;
    try { applyPlan(event.data.plan); status("تم تطبيق خطة واردة من تكامل محلي. راجع المشاهد قبل التصدير.", "success"); }
    catch (error) { status("رفضت الخطة الواردة: " + (error?.message || String(error)), "error"); }
  });
  window.dispatchEvent(new CustomEvent("bem2027-ai-bridge-ready", { detail: { version: bridge.version } }));
})();
