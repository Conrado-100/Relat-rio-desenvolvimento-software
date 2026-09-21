(() => {
  "use strict";

  /*
    Controle central do progresso do curso.

    Estrutura salva:
    {
      version: 3,
      modules: {
        "1": {
          started: true/false,
          completed: true/false,
          percent: 0-100,
          startedAt: "...",
          completedAt: "...",
          lessonsCompleted: ["1", "2", ...]
        },
        ...
      }
    }
  */

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

    return {
      version: 3,
      modules
    };
  }

  function clamp(value) {
    const number = Number(value);

    if (!Number.isFinite(number)) {
      return 0;
    }

    return Math.max(0, Math.min(100, Math.round(number)));
  }

  function normalizeModule(base, saved) {
    const source = saved && typeof saved === "object" ? saved : {};

    return {
      ...base,
      ...source,
      started: Boolean(source.started),
      completed: Boolean(source.completed),
      percent: clamp(source.percent),
      startedAt: source.startedAt || null,
      completedAt: source.completedAt || null,
      lessonsCompleted: Array.isArray(source.lessonsCompleted)
        ? [...new Set(source.lessonsCompleted.map(String))]
        : []
    };
  }

  function normalizeProgress(saved) {
    const state = createDefaultProgress();

    if (!saved || typeof saved !== "object") {
      return state;
    }

    for (let i = 1; i <= MODULE_COUNT; i += 1) {
      const id = String(i);
      const savedModule =
        saved.modules?.[id] ??
        saved.modules?.[i] ??
        {};

      state.modules[id] = normalizeModule(
        state.modules[id],
        savedModule
      );
    }

    return state;
  }

  function readStorage(key) {
    try {
      const raw = localStorage.getItem(key);

      if (!raw) {
        return null;
      }

      return JSON.parse(raw);
    } catch (error) {
      console.warn(`Não foi possível ler ${key}.`, error);
      return null;
    }
  }

  function load() {
    const current = readStorage(STORAGE_KEY);

    if (current) {
      return normalizeProgress(current);
    }

    for (const legacyKey of LEGACY_KEYS) {
      const legacy = readStorage(legacyKey);

      if (!legacy) {
        continue;
      }

      const migrated = normalizeProgress(legacy);

      try {
        localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify(migrated)
        );
      } catch (error) {
        console.warn(
          "Não foi possível salvar a migração do progresso.",
          error
        );
      }

      return migrated;
    }

    return createDefaultProgress();
  }

  function save(progress) {
    const normalized = normalizeProgress(progress);

    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(normalized)
      );
    } catch (error) {
      console.warn(
        "Não foi possível salvar o progresso.",
        error
      );
    }

    window.dispatchEvent(
      new CustomEvent("courseprogress:changed", {
        detail: normalized
      })
    );

    return normalized;
  }

  function getModule(moduleId) {
    const id = String(moduleId);
    const state = load();

    return state.modules[id] || null;
  }

  function markStarted(moduleId) {
    const id = String(moduleId);
    const state = load();
    const module = state.modules[id];

    if (!module) {
      return state;
    }

    if (!module.started) {
      module.started = true;
      module.startedAt = new Date().toISOString();
      save(state);
    }

    return state;
  }

  function getLessonInputs() {
    return Array.from(
      document.querySelectorAll(
        "[data-lesson] input[type='checkbox']"
      )
    ).map(input => ({
      input,
      lessonId: input.closest("[data-lesson]")?.dataset.lesson
    })).filter(item => item.lessonId);
  }

  function calculateModuleFromPage(moduleId) {
    const id = String(moduleId);
    const state = load();
    const module = state.modules[id];

    if (!module) {
      return state;
    }

    const lessons = getLessonInputs();
    const total = lessons.length;

    const completedLessons = lessons
      .filter(item => item.input.checked)
      .map(item => String(item.lessonId));

    module.lessonsCompleted = [
      ...new Set(completedLessons)
    ];

    if (total === 0) {
      module.percent = 0;
      module.completed = false;
    } else {
      module.started = true;

      if (!module.startedAt) {
        module.startedAt = new Date().toISOString();
      }

      module.percent = Math.round(
        (completedLessons.length / total) * 100
      );

      module.completed = completedLessons.length === total;

      module.completedAt = module.completed
        ? (module.completedAt || new Date().toISOString())
        : null;
    }

    return save(state);
  }

  function setLesson(moduleId, lessonId, completed) {
    const id = String(moduleId);
    const state = load();
    const module = state.modules[id];

    if (!module) {
      return state;
    }

    const lessons = new Set(
      module.lessonsCompleted || []
    );

    if (completed) {
      lessons.add(String(lessonId));
    } else {
      lessons.delete(String(lessonId));
    }

    module.lessonsCompleted = [...lessons];
    module.started = true;

    if (!module.startedAt) {
      module.startedAt = new Date().toISOString();
    }

    return save(state);
  }

  function hydratePage(moduleId) {
    const id = String(moduleId);

    markStarted(id);

    const module = getModule(id);

    if (!module) {
      return;
    }

    const completedLessons = new Set(
      module.lessonsCompleted || []
    );

    getLessonInputs().forEach(({ input, lessonId }) => {
      input.checked = completedLessons.has(
        String(lessonId)
      );
    });
  }

  function renderPageProgress(moduleId) {
    const module = getModule(moduleId);

    if (!module) {
      return;
    }

    const percent = clamp(module.percent);

    document
      .querySelectorAll("[data-progress-fill]")
      .forEach(element => {
        element.style.width = `${percent}%`;
        element.setAttribute(
          "aria-valuenow",
          String(percent)
        );
      });

    document
      .querySelectorAll("[data-progress-percent]")
      .forEach(element => {
        element.textContent = `${percent}%`;
      });

    document
      .querySelectorAll("[data-module-status]")
      .forEach(element => {
        element.textContent = module.completed
          ? "Concluído"
          : module.started
            ? "Em andamento"
            : "Não iniciado";
      });

    document
      .querySelectorAll("[data-module-page], [data-module]")
      .forEach(element => {
        if (
          element.matches(".module-card") ||
          !element.dataset.module
        ) {
          return;
        }

        element.dataset.status = module.completed
          ? "complete"
          : module.started
            ? "started"
            : "not-started";
      });
  }

  function setupPage(moduleId) {
    const page = document.querySelector(
      "[data-module][data-module-page], main[data-module]"
    );

    if (!page) {
      return;
    }

    const id = String(moduleId);

    hydratePage(id);

    getLessonInputs().forEach(({ input, lessonId }) => {
      if (input.dataset.progressBound === "true") {
        return;
      }

      input.dataset.progressBound = "true";

      input.addEventListener("change", () => {
        setLesson(id, lessonId, input.checked);
        calculateModuleFromPage(id);
        renderPageProgress(id);
      });
    });

    calculateModuleFromPage(id);
    renderPageProgress(id);
  }

  function getSummary() {
    const state = load();
    const modules = Object.values(state.modules);

    const started = modules.filter(
      module => module.started
    ).length;

    const completed = modules.filter(
      module => module.completed
    ).length;

    const overall = Math.round(
      modules.reduce(
        (sum, module) => sum + clamp(module.percent),
        0
      ) / MODULE_COUNT
    );

    return {
      started,
      completed,
      overall,
      remaining: MODULE_COUNT - completed
    };
  }

  function getLastStarted() {
    const state = load();

    return Object.entries(state.modules)
      .filter(([, module]) => module.started)
      .sort(
        ([, a], [, b]) =>
          new Date(b.startedAt || 0) -
          new Date(a.startedAt || 0)
      )[0] || null;
  }

  function reset() {
    const clean = createDefaultProgress();

    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(clean)
      );
    } catch (error) {
      console.warn(
        "Não foi possível zerar o progresso.",
        error
      );
    }

    window.dispatchEvent(
      new CustomEvent("courseprogress:changed", {
        detail: clean
      })
    );
  }

  window.CourseProgress = {
    STORAGE_KEY,
    MODULE_COUNT,
    load,
    save,
    reset,
    getModule,
    markStarted,
    setLesson,
    calculateModuleFromPage,
    hydratePage,
    renderPageProgress,
    setupPage,
    getSummary,
    getLastStarted
  };

  document.addEventListener("DOMContentLoaded", () => {
    const page = document.querySelector(
      "[data-module][data-module-page], main[data-module]"
    );

    if (page) {
      setupPage(page.dataset.module);
    }
  });
})();
