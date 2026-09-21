(() => {
  "use strict";

  const STORAGE_KEY = "curso-engenharia-software-progress-v3";
  const LEGACY_KEYS = ["curso-engenharia-software-progress-v2"];
  const MODULE_COUNT = 5;

  function createDefaultProgress() {
    const modules = {};
    for (let i = 1; i <= MODULE_COUNT; i += 1) {
      modules[String(i)] = {
        started: false,
        completed: false,
        percent: 0,
        startedAt: null,
        completedAt: null,
        lessonsCompleted: []
      };
    }
    return { version: 3, modules };
  }

  function clamp(value) {
    const number = Number(value);
    return Number.isFinite(number) ? Math.max(0, Math.min(100, Math.round(number))) : 0;
  }

  function normalizeModule(base, saved = {}) {
    return {
      ...base,
      ...saved,
      started: Boolean(saved.started),
      completed: Boolean(saved.completed),
      percent: clamp(saved.percent),
      startedAt: saved.startedAt || null,
      completedAt: saved.completedAt || null,
      lessonsCompleted: Array.isArray(saved.lessonsCompleted)
        ? [...new Set(saved.lessonsCompleted.map(String))]
        : []
    };
  }

  function normalizeProgress(saved) {
    const defaults = createDefaultProgress();
    if (!saved || typeof saved !== "object") return defaults;

    for (let i = 1; i <= MODULE_COUNT; i += 1) {
      const id = String(i);
      const source = saved.modules?.[id] ?? saved.modules?.[i];
      defaults.modules[id] = normalizeModule(defaults.modules[id], source || {});
    }

    return defaults;
  }

  function readKey(key) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch (error) {
      console.warn(`Não foi possível ler ${key}.`, error);
      return null;
    }
  }

  function load() {
    const current = readKey(STORAGE_KEY);
    if (current) return normalizeProgress(current);

    for (const key of LEGACY_KEYS) {
      const legacy = readKey(key);
      if (!legacy) continue;

      const migrated = normalizeProgress(legacy);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
      } catch (error) {
        console.warn("Não foi possível salvar a migração do progresso.", error);
      }
      return migrated;
    }

    return createDefaultProgress();
  }

  function save(progress) {
    const normalized = normalizeProgress(progress);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
    } catch (error) {
      console.warn("Não foi possível salvar o progresso.", error);
    }

    window.dispatchEvent(
      new CustomEvent("courseprogress:changed", { detail: normalized })
    );
    return normalized;
  }

  function getModule(moduleId) {
    return load().modules[String(moduleId)] || null;
  }

  function areAllModulesComplete() {
    const state = load();
    return Array.from({ length: MODULE_COUNT }, (_, index) => String(index + 1))
      .every(id => clamp(state.modules[id]?.percent) === 100);
  }

  function markStarted(moduleId) {
    const state = load();
    const id = String(moduleId);
    const module = state.modules[id];
    if (!module) return state;

    if (!module.started) {
      module.started = true;
      module.startedAt = new Date().toISOString();
      save(state);
    }

    return state;
  }

  function getLessonInputs() {
    return [...document.querySelectorAll("[data-lesson]")]
      .map(container => {
        if (container.matches('input[type="checkbox"]')) {
          return { input: container, lessonId: container.dataset.lesson };
        }
        const input = container.querySelector('input[type="checkbox"]');
        return { input, lessonId: container.dataset.lesson };
      })
      .filter(item => item.input && item.lessonId);
  }

  function calculateModuleFromPage(moduleId) {
    const state = load();
    const id = String(moduleId);
    const module = state.modules[id];
    if (!module) return state;

    const lessons = getLessonInputs();
    const total = lessons.length;
    const completedLessons = lessons
      .filter(item => item.input.checked)
      .map(item => String(item.lessonId));

    module.lessonsCompleted = [...new Set(completedLessons)];

    if (total > 0) {
      module.started = true;
      if (!module.startedAt) module.startedAt = new Date().toISOString();
      module.percent = Math.round((completedLessons.length / total) * 100);
      module.completed = module.percent === 100;
      module.completedAt = module.completed
        ? (module.completedAt || new Date().toISOString())
        : null;
    }

    return save(state);
  }

  function setLesson(moduleId, lessonId, completed) {
    const state = load();
    const id = String(moduleId);
    const module = state.modules[id];
    if (!module) return state;

    const lessons = new Set(module.lessonsCompleted || []);
    if (completed) lessons.add(String(lessonId));
    else lessons.delete(String(lessonId));

    module.lessonsCompleted = [...lessons];
    module.started = true;
    if (!module.startedAt) module.startedAt = new Date().toISOString();

    return save(state);
  }

  function hydratePage(moduleId) {
    const id = String(moduleId);
    const state = markStarted(id);
    const completed = new Set(state.modules[id]?.lessonsCompleted || []);

    for (const { input, lessonId } of getLessonInputs()) {
      input.checked = completed.has(String(lessonId));
    }

    return calculateModuleFromPage(id);
  }

  function renderPageProgress(moduleId) {
    const module = getModule(moduleId);
    if (!module) return;

    const percent = clamp(module.percent);
    document.querySelectorAll("[data-progress-fill]").forEach(element => {
      element.style.width = `${percent}%`;
      element.setAttribute("aria-valuenow", String(percent));
    });

    document.querySelectorAll("[data-progress-percent]").forEach(element => {
      element.textContent = `${percent}%`;
    });

    document.querySelectorAll("[data-module-status]").forEach(element => {
      element.textContent = module.completed
        ? "Concluído"
        : module.started
          ? "Em andamento"
          : "Não iniciado";
    });

    document.querySelectorAll("[data-module-page]").forEach(element => {
      element.dataset.status = module.completed
        ? "complete"
        : module.started
          ? "started"
          : "not-started";
    });
  }

  function setupPage(moduleId) {
    const id = String(moduleId);
    if (!document.querySelector(".module-shell[data-module]")) return;

    hydratePage(id);

    for (const { input, lessonId } of getLessonInputs()) {
      if (input.dataset.progressBound === "true") continue;
      input.dataset.progressBound = "true";
      input.addEventListener("change", () => {
        setLesson(id, lessonId, input.checked);
        calculateModuleFromPage(id);
        renderPageProgress(id);
      });
    }

    renderPageProgress(id);
  }

  function getSummary() {
    const state = load();
    const modules = Object.values(state.modules);
    const started = modules.filter(module => module.started).length;
    const completed = modules.filter(module => module.completed).length;
    const overall = Math.round(
      modules.reduce((sum, module) => sum + clamp(module.percent), 0) / MODULE_COUNT
    );

    return { started, completed, overall, remaining: MODULE_COUNT - completed };
  }

  function getLastStarted() {
    const state = load();
    return Object.entries(state.modules)
      .filter(([, module]) => module.started)
      .sort(([, a], [, b]) =>
        new Date(b.startedAt || 0) - new Date(a.startedAt || 0)
      )[0] || null;
  }


  function renderHome() {
    if (!document.body.classList.contains("home-page")) return;

    const state = load();
    const summary = getSummary();
    const topText = document.getElementById("topProgressText");
    const topFill = document.getElementById("topProgressFill");

    if (topText) topText.textContent = `${summary.overall}% concluído`;
    if (topFill) {
      topFill.style.width = `${summary.overall}%`;
      topFill.setAttribute("aria-valuenow", String(summary.overall));
    }

    const values = {
      statModules: `${summary.started}/${MODULE_COUNT}`,
      statCompleted: String(summary.completed),
      statItems: `${summary.overall}%`,
      statRemaining: String(summary.remaining)
    };
    Object.entries(values).forEach(([id, value]) => {
      const el = document.getElementById(id);
      if (el) el.textContent = value;
    });

    const resumeBox = document.getElementById("resumeBox");
    const last = getLastStarted();
    if (resumeBox) {
      if (last) {
        const [id, module] = last;
        resumeBox.innerHTML = `
          <p><strong>Último módulo iniciado:</strong> Módulo ${String(id).padStart(2, "0")}.</p>
          <p>Progresso atual: <strong>${module.percent}%</strong>.</p>
          <a class="btn primary" href="modulos/modulo-${id}.html">Retomar módulo →</a>
        `;
      } else {
        resumeBox.innerHTML = `
          <p><strong>Primeiro passo:</strong> escolha um dos cinco módulos abaixo.</p>
          <p>Ao abrir um módulo, ele será registrado como iniciado e seu progresso ficará salvo neste navegador.</p>
        `;
      }
    }

    document.querySelectorAll(".module-card[data-module]").forEach(card => {
      const module = state.modules[String(card.dataset.module)];
      if (!module) return;
      const percent = clamp(module.percent);
      const label = card.querySelector(".status-label");
      const percentEl = card.querySelector(".status-percent");
      const bar = card.querySelector(".module-progress span");
      const cta = card.querySelector(".module-cta");

      card.classList.toggle("is-started", module.started);
      card.classList.toggle("is-complete", module.completed);
      card.dataset.status = module.completed ? "complete" : module.started ? "started" : "not-started";
      if (label) label.textContent = module.completed ? "Concluído" : module.started ? "Em andamento" : "Não iniciado";
      if (percentEl) percentEl.textContent = `${percent}%`;
      if (bar) bar.style.width = `${percent}%`;
      if (cta) cta.innerHTML = module.completed
        ? '✓ Módulo concluído <span aria-hidden="true">→</span>'
        : module.started
          ? 'Continuar módulo <span aria-hidden="true">→</span>'
          : 'Começar módulo <span aria-hidden="true">→</span>';
    });

    const finalStage = document.getElementById("finalStageCard");
    const finalStageLink = document.getElementById("finalStageLink");
    const finalStageIcon = document.getElementById("finalStageIcon");
    const finalStageDescription = document.getElementById("finalStageDescription");
    const finalStageUnlocked = areAllModulesComplete();

    if (finalStage) finalStage.dataset.status = finalStageUnlocked ? "unlocked" : "locked";
    if (finalStageIcon) finalStageIcon.textContent = finalStageUnlocked ? "🔓" : "🔒";
    if (finalStageDescription) {
      finalStageDescription.textContent = finalStageUnlocked
        ? "Todos os módulos foram concluídos. A avaliação final está disponível."
        : "Conclua os 5 módulos com 100% de progresso para desbloquear esta etapa.";
    }
    if (finalStageLink) {
      finalStageLink.textContent = finalStageUnlocked ? "Acessar avaliação →" : "Etapa bloqueada";
      finalStageLink.setAttribute("aria-disabled", String(!finalStageUnlocked));
      finalStageLink.tabIndex = finalStageUnlocked ? 0 : -1;
      finalStageLink.classList.toggle("is-disabled", !finalStageUnlocked);
    }
  }

  function setupHome() {
    if (!document.body.classList.contains("home-page")) return;

    document.querySelectorAll(".module-card[data-module]").forEach(card => {
      if (card.dataset.progressBound === "true") return;
      card.dataset.progressBound = "true";
      card.addEventListener("click", () => markStarted(card.dataset.module));
    });

    const finalStageLink = document.getElementById("finalStageLink");
    if (finalStageLink && finalStageLink.dataset.progressBound !== "true") {
      finalStageLink.dataset.progressBound = "true";
      finalStageLink.addEventListener("click", event => {
        if (!areAllModulesComplete()) event.preventDefault();
      });
    }

    const resetButton = document.getElementById("resetProgress");
    if (resetButton && resetButton.dataset.progressBound !== "true") {
      resetButton.dataset.progressBound = "true";
      resetButton.addEventListener("click", event => {
        event.preventDefault();
        if (!window.confirm("Tem certeza que deseja zerar todo o progresso salvo neste navegador?")) return;
        reset();
        const toast = document.getElementById("toast");
        if (toast) {
          toast.textContent = "Progresso zerado com sucesso.";
          toast.classList.add("show");
          clearTimeout(window.__courseToastTimer);
          window.__courseToastTimer = setTimeout(() => toast.classList.remove("show"), 3600);
        }
      });
    }

    renderHome();
  }

  function reset() {
    const clean = createDefaultProgress();
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(clean));
    } catch (error) {
      console.warn("Não foi possível zerar o progresso.", error);
    }
    window.dispatchEvent(new CustomEvent("courseprogress:changed", { detail: clean }));
  }

  window.CourseProgress = {
    STORAGE_KEY,
    MODULE_COUNT,
    load,
    save,
    reset,
    getModule,
    areAllModulesComplete,
    markStarted,
    setLesson,
    calculateModuleFromPage,
    hydratePage,
    renderPageProgress,
    setupPage,
    getSummary,
    getLastStarted,
    renderHome,
    setupHome
  };

  document.addEventListener("DOMContentLoaded", () => {
    setupHome();
    const page = document.querySelector(".module-shell[data-module]");
    if (page) setupPage(page.dataset.module);
    renderHome();
  });

  window.addEventListener("courseprogress:changed", () => {
    renderHome();
    const page = document.querySelector(".module-shell[data-module]");
    if (page) renderPageProgress(page.dataset.module);
  });

  window.addEventListener("storage", event => {
    if (event.key === STORAGE_KEY) {
      renderHome();
      const page = document.querySelector(".module-shell[data-module]");
      if (page) renderPageProgress(page.dataset.module);
    }
  });
})();
