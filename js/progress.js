(() => {
  "use strict";

  const STORAGE_KEY = "curso-engenharia-software-progress-v3";
  const MODULE_COUNT = 5;

  function defaultModule() {
    return { started:false, completed:false, percent:0, startedAt:null, completedAt:null, lessonsCompleted:[] };
  }

  function createDefaultProgress() {
    const modules = {};
    for (let i = 1; i <= MODULE_COUNT; i++) modules[String(i)] = defaultModule();
    return { modules };
  }

  function clampPercent(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return 0;
    return Math.max(0, Math.min(100, Math.round(n)));
  }

  function normalizeModule(saved) {
    const data = saved && typeof saved === "object" ? saved : {};
    return {
      ...defaultModule(), ...data,
      started: Boolean(data.started),
      completed: Boolean(data.completed),
      percent: clampPercent(data.percent),
      startedAt: data.startedAt || null,
      completedAt: data.completedAt || null,
      lessonsCompleted: Array.isArray(data.lessonsCompleted) ? [...new Set(data.lessonsCompleted.map(String))] : []
    };
  }

  function load() {
    const state = createDefaultProgress();
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return state;
      const saved = JSON.parse(raw);
      if (!saved || typeof saved !== "object") return state;
      for (let i = 1; i <= MODULE_COUNT; i++) {
        const id = String(i);
        state.modules[id] = normalizeModule(saved.modules?.[id]);
      }
    } catch (error) {
      console.warn("Não foi possível ler o progresso salvo.", error);
    }
    return state;
  }

  function save(state) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
    catch (error) { console.warn("Não foi possível salvar o progresso.", error); }
    window.dispatchEvent(new CustomEvent("courseprogress:changed", { detail: state }));
  }

  function getModule(moduleId) {
    return load().modules[String(moduleId)] || null;
  }

  function markStarted(moduleId) {
    const state = load();
    const module = state.modules[String(moduleId)];
    if (!module) return state;
    if (!module.started) {
      module.started = true;
      module.startedAt = new Date().toISOString();
      save(state);
    }
    return state;
  }

  function calculateFromPage(moduleId) {
    const state = load();
    const module = state.modules[String(moduleId)];
    if (!module) return state;

    const inputs = Array.from(document.querySelectorAll("[data-lesson] input[type='checkbox']"));
    const checked = inputs.filter(input => input.checked).map(input => String(input.closest("[data-lesson]")?.dataset.lesson || "")).filter(Boolean);
    const total = inputs.length;

    module.lessonsCompleted = [...new Set(checked)];
    module.percent = total ? Math.round((checked.length / total) * 100) : 0;
    if (total && !module.started) {
      module.started = true;
      module.startedAt = new Date().toISOString();
    }
    module.completed = total > 0 && checked.length === total;
    module.completedAt = module.completed ? (module.completedAt || new Date().toISOString()) : null;

    save(state);
    renderPage(moduleId);
    return state;
  }

  function hydratePage(moduleId) {
    markStarted(moduleId);
    const module = getModule(moduleId);
    const completed = new Set(module?.lessonsCompleted || []);

    document.querySelectorAll("[data-lesson]").forEach(item => {
      const input = item.matches("input[type='checkbox']") ? item : item.querySelector("input[type='checkbox']");
      if (input) input.checked = completed.has(String(item.dataset.lesson));
    });
  }

  function renderPage(moduleId) {
    const module = getModule(moduleId);
    if (!module) return;
    const percent = clampPercent(module.percent);

    document.querySelectorAll("[data-progress-fill]").forEach(el => {
      el.style.width = `${percent}%`;
      el.setAttribute("aria-valuenow", String(percent));
    });
    document.querySelectorAll("[data-progress-percent]").forEach(el => el.textContent = `${percent}%`);
    document.querySelectorAll("[data-module-status]").forEach(el => {
      el.textContent = module.completed ? "Concluído" : module.started ? "Em andamento" : "Não iniciado";
    });
    document.querySelectorAll("[data-module-page]").forEach(el => {
      el.dataset.status = module.completed ? "complete" : module.started ? "started" : "not-started";
    });
  }

  function setupPage(moduleId) {
    const id = String(moduleId);
    document.querySelectorAll("[data-lesson]").forEach(item => {
      const input = item.matches("input[type='checkbox']") ? item : item.querySelector("input[type='checkbox']");
      if (!input || input.dataset.progressBound === "true") return;
      input.dataset.progressBound = "true";
      input.addEventListener("change", () => calculateFromPage(id));
    });
    hydratePage(id);
    calculateFromPage(id);
  }

  function getSummary() {
    const modules = Object.values(load().modules);
    const started = modules.filter(m => m.started).length;
    const completed = modules.filter(m => m.completed).length;
    const overall = Math.round(modules.reduce((sum, m) => sum + clampPercent(m.percent), 0) / MODULE_COUNT);
    return { started, completed, overall, remaining: MODULE_COUNT - completed };
  }

  function getLastStarted() {
    return Object.entries(load().modules)
      .filter(([, m]) => m.started)
      .sort(([, a], [, b]) => new Date(b.startedAt || 0) - new Date(a.startedAt || 0))[0] || null;
  }

  function reset() {
    try { localStorage.removeItem(STORAGE_KEY); } catch (error) { console.warn(error); }
    window.dispatchEvent(new CustomEvent("courseprogress:changed", { detail: createDefaultProgress() }));
  }

  window.CourseProgress = { STORAGE_KEY, MODULE_COUNT, load, save, getModule, markStarted, calculateFromPage, hydratePage, renderPage, setupPage, getSummary, getLastStarted, reset };

  document.addEventListener("DOMContentLoaded", () => {
    const page = document.querySelector("[data-module-page][data-module]");
    if (page) setupPage(page.dataset.module);
  });
})();
