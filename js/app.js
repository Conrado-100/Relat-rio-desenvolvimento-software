(() => {
  "use strict";

  /*
    Comportamento exclusivo da página inicial (index.html).

    Responsabilidades:
    - mostrar o progresso geral;
    - atualizar os 5 cartões dos módulos;
    - mostrar o último módulo iniciado;
    - permitir zerar o progresso.
  */

  function query(selector) {
    return document.querySelector(selector);
  }

  function showToast(message) {
    const toast = query("#toast");

    if (!toast) {
      return;
    }

    toast.textContent = message;
    toast.classList.add("show");

    clearTimeout(window.__courseToastTimer);

    window.__courseToastTimer = setTimeout(() => {
      toast.classList.remove("show");
    }, 3500);
  }

  function renderHome() {
    if (!window.CourseProgress) {
      return;
    }

    const state = CourseProgress.load();
    const summary = CourseProgress.getSummary();

    const topText = query("#topProgressText");
    const topFill = query("#topProgressFill");

    if (topText) {
      topText.textContent = `${summary.overall}% concluído`;
    }

    if (topFill) {
      topFill.style.width = `${summary.overall}%`;
      topFill.setAttribute(
        "aria-valuenow",
        String(summary.overall)
      );
    }

    const statModules = query("#statModules");
    const statCompleted = query("#statCompleted");
    const statItems = query("#statItems");
    const statRemaining = query("#statRemaining");

    if (statModules) {
      statModules.textContent =
        `${summary.started}/${CourseProgress.MODULE_COUNT}`;
    }

    if (statCompleted) {
      statCompleted.textContent =
        String(summary.completed);
    }

    if (statItems) {
      statItems.textContent =
        `${summary.overall}%`;
    }

    if (statRemaining) {
      statRemaining.textContent =
        String(summary.remaining);
    }

    const resumeBox = query("#resumeBox");
    const last = CourseProgress.getLastStarted();

    if (resumeBox) {
      if (last) {
        const [id, module] = last;

        resumeBox.innerHTML = `
          <p>
            <strong>Último módulo iniciado:</strong>
            Módulo ${String(id).padStart(2, "0")}.
          </p>

          <p>
            Progresso atual:
            <strong>${module.percent}%</strong>.
          </p>

          <a
            class="btn primary"
            href="modulos/modulo-${id}.html"
          >
            Retomar módulo →
          </a>
        `;
      } else {
        resumeBox.innerHTML = `
          <p>
            <strong>Primeiro passo:</strong>
            escolha um dos cinco módulos abaixo.
          </p>

          <p>
            Ao abrir um módulo, ele será registrado como iniciado
            e seu progresso poderá ser retomado depois.
          </p>
        `;
      }
    }

    document
      .querySelectorAll(".module-card[data-module]")
      .forEach(card => {
        const id = String(card.dataset.module);
        const module = state.modules[id];

        if (!module) {
          return;
        }

        const percent = Math.max(
          0,
          Math.min(100, Number(module.percent) || 0)
        );

        const statusLabel =
          card.querySelector(".status-label");

        const statusPercent =
          card.querySelector(".status-percent");

        const progressBar =
          card.querySelector(".module-progress span");

        const cta =
          card.querySelector(".module-cta");

        const status =
          module.completed
            ? "complete"
            : module.started
              ? "started"
              : "not-started";

        card.dataset.status = status;

        card.classList.toggle(
          "is-started",
          module.started
        );

        card.classList.toggle(
          "is-complete",
          module.completed
        );

        if (statusLabel) {
          statusLabel.textContent =
            module.completed
              ? "Concluído"
              : module.started
                ? "Em andamento"
                : "Não iniciado";
        }

        if (statusPercent) {
          statusPercent.textContent = `${percent}%`;
        }

        if (progressBar) {
          progressBar.style.width = `${percent}%`;
        }

        if (cta) {
          cta.innerHTML =
            module.completed
              ? '✓ Módulo concluído <span aria-hidden="true">→</span>'
              : module.started
                ? 'Continuar módulo <span aria-hidden="true">→</span>'
                : 'Começar módulo <span aria-hidden="true">→</span>';
        }
      });
  }

  function init() {
    if (!window.CourseProgress) {
      console.warn(
        "CourseProgress não foi carregado antes do app.js."
      );
      return;
    }

    document
      .querySelectorAll(".module-card[data-module]")
      .forEach(card => {
        card.addEventListener("click", () => {
          CourseProgress.markStarted(
            card.dataset.module
          );
        });
      });

    const resetButton =
      query("#resetProgress");

    if (resetButton) {
      resetButton.addEventListener("click", () => {
        const confirmed = window.confirm(
          "Deseja realmente zerar todo o progresso deste navegador?"
        );

        if (!confirmed) {
          return;
        }

        CourseProgress.reset();
        renderHome();
        showToast("Progresso zerado.");
      });
    }

    window.addEventListener(
      "courseprogress:changed",
      renderHome
    );

    window.addEventListener(
      "storage",
      event => {
        if (
          event.key ===
          CourseProgress.STORAGE_KEY
        ) {
          renderHome();
        }
      }
    );

    renderHome();
  }

  if (document.readyState === "loading") {
    document.addEventListener(
      "DOMContentLoaded",
      init,
      { once: true }
    );
  } else {
    init();
  }
})();
