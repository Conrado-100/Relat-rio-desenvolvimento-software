(() => {
  "use strict";

  const $ = selector => document.querySelector(selector);

  function showToast(message) {
    const toast = $("#toast");
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add("show");
    clearTimeout(window.__courseToastTimer);
    window.__courseToastTimer = setTimeout(() => toast.classList.remove("show"), 3200);
  }

  function renderHome() {
    if (!window.CourseProgress) return;

    const state = CourseProgress.load();
    const summary = CourseProgress.getSummary();

    const text = $("#topProgressText");
    const fill = $("#topProgressFill");
    if (text) text.textContent = `${summary.overall}% concluído`;
    if (fill) { fill.style.width = `${summary.overall}%`; fill.setAttribute("aria-valuenow", String(summary.overall)); }

    const statModules = $("#statModules");
    const statCompleted = $("#statCompleted");
    const statItems = $("#statItems");
    const statRemaining = $("#statRemaining");
    if (statModules) statModules.textContent = `${summary.started}/5`;
    if (statCompleted) statCompleted.textContent = String(summary.completed);
    if (statItems) statItems.textContent = `${summary.overall}%`;
    if (statRemaining) statRemaining.textContent = String(summary.remaining);

    const resumeBox = $("#resumeBox");
    const last = CourseProgress.getLastStarted();
    if (resumeBox) {
      if (last) {
        const [id, module] = last;
        resumeBox.innerHTML = `<p><strong>Último módulo iniciado:</strong> Módulo ${String(id).padStart(2, "0")}.</p><p>Progresso atual: <strong>${module.percent}%</strong>.</p><a class="btn primary" href="modulos/modulo-${id}.html">Retomar módulo →</a>`;
      } else {
        resumeBox.innerHTML = `<p><strong>Comece pela Trilha de Aprendizagem.</strong></p><p>Ao abrir um módulo, ele será automaticamente registrado como iniciado.</p>`;
      }
    }

    document.querySelectorAll(".module-card[data-module]").forEach(card => {
      const module = state.modules[String(card.dataset.module)];
      if (!module) return;
      const percent = Number(module.percent) || 0;
      const status = card.querySelector(".status-label");
      const statusPercent = card.querySelector(".status-percent");
      const bar = card.querySelector(".module-progress span");
      const cta = card.querySelector(".module-cta");

      card.classList.toggle("is-started", module.started);
      card.classList.toggle("is-complete", module.completed);
      if (status) status.textContent = module.completed ? "Concluído" : module.started ? "Em andamento" : "Não iniciado";
      if (statusPercent) statusPercent.textContent = `${percent}%`;
      if (bar) bar.style.width = `${percent}%`;
      if (cta) cta.innerHTML = module.completed ? "✓ Módulo concluído →" : module.started ? "Continuar módulo →" : "Começar módulo →";
    });
  }

  function init() {
    if (!window.CourseProgress) return;

    document.querySelectorAll(".module-card[data-module]").forEach(card => {
      card.addEventListener("click", () => CourseProgress.markStarted(card.dataset.module));
    });

    const reset = $("#resetProgress");
    if (reset) reset.addEventListener("click", () => {
      if (!window.confirm("Deseja realmente zerar todo o progresso deste navegador?")) return;
      CourseProgress.reset();
      renderHome();
      showToast("Progresso zerado.");
    });

    window.addEventListener("storage", event => { if (event.key === CourseProgress.STORAGE_KEY) renderHome(); });
    window.addEventListener("courseprogress:changed", renderHome);
    renderHome();
  }

  document.addEventListener("DOMContentLoaded", init);
})();
