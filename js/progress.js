(() => {
  'use strict';

  const STORAGE_KEY = 'curso-engenharia-software-progress-v2';
  const MODULE_COUNT = 5;

  function createDefaultProgress() {
    return {
      modules: Object.fromEntries(
        Array.from({ length: MODULE_COUNT }, (_, index) => {
          const id = String(index + 1);
          return [id, {
            started: false,
            completed: false,
            percent: 0,
            startedAt: null,
            completedAt: null,
            lessonsCompleted: []
          }];
        })
      )
    };
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function normalizeModule(base, saved = {}) {
    const lessonsCompleted = Array.isArray(saved.lessonsCompleted)
      ? [...new Set(saved.lessonsCompleted.map(String))]
      : [];

    return {
      ...base,
      ...saved,
      started: Boolean(saved.started),
      completed: Boolean(saved.completed),
      percent: Math.max(0, Math.min(100, Number(saved.percent) || 0)),
      startedAt: saved.startedAt || null,
      completedAt: saved.completedAt || null,
      lessonsCompleted
    };
  }

  function load() {
    const defaults = createDefaultProgress();

    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (!saved || !saved.modules) return defaults;

      for (let i = 1; i <= MODULE_COUNT; i += 1) {
        const id = String(i);
        defaults.modules[id] = normalizeModule(defaults.modules[id], saved.modules[id] ?? saved.modules[i]);
      }

      return defaults;
    } catch (error) {
      console.warn('Não foi possível ler o progresso salvo.', error);
      return defaults;
    }
  }

  function save(progress) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
    window.dispatchEvent(new CustomEvent('courseprogress:changed', { detail: progress }));
  }

  function updateModule(moduleId, patch) {
    const progress = load();
    const id = String(moduleId);
    if (!progress.modules[id]) return progress;

    progress.modules[id] = normalizeModule(progress.modules[id], patch);
    save(progress);
    return progress;
  }

  function markStarted(moduleId) {
    const progress = load();
    const id = String(moduleId);
    const module = progress.modules[id];
    if (!module) return progress;

    if (!module.started) {
      module.started = true;
      module.startedAt = new Date().toISOString();
      save(progress);
    }

    return progress;
  }

  function calculateModuleFromPage(moduleId) {
    const progress = load();
    const id = String(moduleId);
    const module = progress.modules[id];
    if (!module) return progress;

    const boxes = [...document.querySelectorAll('[data-lesson] input[type="checkbox"], [data-lesson]')]
      .filter(element => element.matches('input[type="checkbox"], [data-lesson]'));

    const lessonElements = boxes.filter(element => element.matches('input[type="checkbox"]'));
    const containers = boxes.filter(element => !element.matches('input[type="checkbox"]'));

    let inputs = lessonElements;
    if (!inputs.length && containers.length) {
      inputs = containers
        .map(container => container.querySelector('input[type="checkbox"]'))
        .filter(Boolean);
    }

    const checkedIds = inputs
      .filter(input => input.checked)
      .map(input => String(input.closest('[data-lesson]')?.dataset.lesson || input.dataset.lesson))
      .filter(Boolean);

    const total = inputs.length;
    const percent = total ? Math.round((checkedIds.length / total) * 100) : 0;

    module.lessonsCompleted = [...new Set(checkedIds)];
    module.started = module.started || total > 0;
    if (module.started && !module.startedAt) module.startedAt = new Date().toISOString();
    module.percent = percent;
    module.completed = total > 0 && percent === 100;
    module.completedAt = module.completed
      ? (module.completedAt || new Date().toISOString())
      : null;

    save(progress);
    return progress;
  }

  function setLesson(moduleId, lessonId, completed) {
    const progress = load();
    const id = String(moduleId);
    const module = progress.modules[id];
    if (!module) return progress;

    const set = new Set(module.lessonsCompleted || []);
    completed ? set.add(String(lessonId)) : set.delete(String(lessonId));
    module.lessonsCompleted = [...set];

    save(progress);
    return calculateModuleFromPage(id);
  }

  function syncFromPage(moduleId) {
    return calculateModuleFromPage(moduleId);
  }

  function hydratePage(moduleId) {
    const id = String(moduleId);
    const progress = markStarted(id);
    const completed = new Set(progress.modules[id]?.lessonsCompleted || []);

    document.querySelectorAll('[data-lesson]').forEach(container => {
      const input = container.matches('input[type="checkbox"]')
        ? container
        : container.querySelector('input[type="checkbox"]');
      if (input) input.checked = completed.has(String(container.dataset.lesson));
    });

    return syncFromPage(id);
  }

  function renderPageProgress(moduleId) {
    const progress = load();
    const id = String(moduleId);
    const module = progress.modules[id];
    if (!module) return;

    const percent = Number(module.percent) || 0;

    document.querySelectorAll('[data-progress-fill]').forEach(element => {
      element.style.width = `${percent}%`;
      element.setAttribute('aria-valuenow', String(percent));
    });

    document.querySelectorAll('[data-progress-percent]').forEach(element => {
      element.textContent = `${percent}%`;
    });

    document.querySelectorAll('[data-module-status]').forEach(element => {
      element.textContent = module.completed
        ? 'Concluído'
        : module.started
          ? 'Em andamento'
          : 'Não iniciado';
    });

    document.querySelectorAll('[data-module-page]').forEach(element => {
      element.dataset.status = module.completed
        ? 'complete'
        : module.started
          ? 'started'
          : 'not-started';
    });
  }

  function setupPage(moduleId) {
    const id = String(moduleId);
    hydratePage(id);

    document.querySelectorAll('[data-lesson]').forEach(container => {
      const input = container.matches('input[type="checkbox"]')
        ? container
        : container.querySelector('input[type="checkbox"]');

      if (!input) return;
      input.addEventListener('change', () => {
        setLesson(id, container.dataset.lesson, input.checked);
        renderPageProgress(id);
      });
    });

    renderPageProgress(id);
  }

  function getSummary() {
    const progress = load();
    const modules = Object.values(progress.modules);
    const started = modules.filter(module => module.started).length;
    const completed = modules.filter(module => module.completed).length;
    const overall = Math.round(
      modules.reduce((sum, module) => sum + Number(module.percent || 0), 0) / MODULE_COUNT
    );

    return {
      started,
      completed,
      overall,
      remaining: MODULE_COUNT - completed
    };
  }

  function getLastStarted() {
    const progress = load();
    return Object.entries(progress.modules)
      .filter(([, module]) => module.started)
      .sort(([, a], [, b]) => new Date(b.startedAt || 0) - new Date(a.startedAt || 0))[0] || null;
  }

  function reset() {
    localStorage.removeItem(STORAGE_KEY);
    window.dispatchEvent(new CustomEvent('courseprogress:changed', { detail: createDefaultProgress() }));
  }

  window.CourseProgress = {
    STORAGE_KEY,
    MODULE_COUNT,
    load,
    save,
    reset,
    updateModule,
    markStarted,
    setLesson,
    syncFromPage,
    hydratePage,
    renderPageProgress,
    setupPage,
    getSummary,
    getLastStarted
  };
})();
