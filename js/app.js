(() => {
  'use strict';

  function qs(selector) {
    return document.querySelector(selector);
  }

  function showToast(message) {
    const toast = qs('#toast');
    if (!toast) return;

    toast.textContent = message;
    toast.classList.add('show');
    clearTimeout(window.__courseToastTimer);
    window.__courseToastTimer = setTimeout(() => toast.classList.remove('show'), 3600);
  }

  function renderHomeProgress() {
    if (!window.CourseProgress) return;

    const progress = CourseProgress.load();
    const summary = CourseProgress.getSummary();

    const topText = qs('#topProgressText');
    const topFill = qs('#topProgressFill');
    if (topText) topText.textContent = `${summary.overall}% concluído`;
    if (topFill) {
      topFill.style.width = `${summary.overall}%`;
      topFill.setAttribute('aria-valuenow', String(summary.overall));
    }

    const statModules = qs('#statModules');
    const statCompleted = qs('#statCompleted');
    const statItems = qs('#statItems');
    const statRemaining = qs('#statRemaining');

    if (statModules) statModules.textContent = `${summary.started}/${CourseProgress.MODULE_COUNT}`;
    if (statCompleted) statCompleted.textContent = String(summary.completed);
    if (statItems) statItems.textContent = `${summary.overall}%`;
    if (statRemaining) statRemaining.textContent = String(summary.remaining);

    const resumeBox = qs('#resumeBox');
    const lastStarted = CourseProgress.getLastStarted();
    if (resumeBox && lastStarted) {
      const [id, module] = lastStarted;
      resumeBox.innerHTML = `
        <p><strong>Último módulo iniciado:</strong> Módulo ${String(id).padStart(2, '0')}.<br>
        Progresso atual: <b>${module.percent || 0}%</b>.</p>
        <p class="resume-link"><a href="modulos/modulo-${id}.html">Retomar módulo →</a></p>
      `;
    } else if (resumeBox) {
      resumeBox.innerHTML = '<p><strong>Primeiro passo:</strong> escolha um dos cinco módulos abaixo. Ao clicar, o curso registrará aquele módulo como <em>iniciado</em>.</p>';
    }

    document.querySelectorAll('.module-card[data-module]').forEach(card => {
      const id = String(card.dataset.module);
      const module = progress.modules[id];
      if (!module) return;

      const percent = Math.max(0, Math.min(100, Number(module.percent || 0)));
      const statusLabel = card.querySelector('.status-label');
      const statusPercent = card.querySelector('.status-percent');
      const progressBar = card.querySelector('.module-progress span');
      const cta = card.querySelector('.module-cta');

      card.classList.toggle('is-started', Boolean(module.started));
      card.classList.toggle('is-complete', Boolean(module.completed));
      card.dataset.status = module.completed
        ? 'complete'
        : module.started
          ? 'started'
          : 'not-started';

      if (statusLabel) {
        statusLabel.textContent = module.completed
          ? 'Concluído'
          : module.started
            ? 'Em andamento'
            : 'Não iniciado';
      }

      if (statusPercent) statusPercent.textContent = `${percent}%`;
      if (progressBar) progressBar.style.width = `${percent}%`;

      if (cta) {
        cta.innerHTML = module.completed
          ? '✓ Módulo concluído <span aria-hidden="true">→</span>'
          : module.started
            ? 'Continuar módulo <span aria-hidden="true">→</span>'
            : 'Começar módulo <span aria-hidden="true">→</span>';
      }
    });
  }

  function setupHome() {
    if (!window.CourseProgress) return;

    document.querySelectorAll('.module-card[data-module]').forEach(card => {
      card.addEventListener('click', () => {
        CourseProgress.markStarted(card.dataset.module);
      });
    });

    const resetButton = qs('#resetProgress');
    if (resetButton) {
      resetButton.addEventListener('click', () => {
        const confirmed = window.confirm('Tem certeza que deseja zerar todo o progresso salvo neste navegador?');
        if (!confirmed) return;

        CourseProgress.reset();
        renderHomeProgress();
        showToast('Progresso zerado com sucesso.');
      });
    }

    window.addEventListener('storage', event => {
      if (event.key === CourseProgress.STORAGE_KEY) renderHomeProgress();
    });

    window.addEventListener('courseprogress:changed', renderHomeProgress);
    renderHomeProgress();
  }

  document.addEventListener('DOMContentLoaded', setupHome);
})();
