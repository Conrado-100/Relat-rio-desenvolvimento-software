(() => {
  "use strict";

  const THEME_KEY = "theme";

  function getStoredTheme() {
    try {
      const stored = localStorage.getItem(THEME_KEY);
      if (stored === "light" || stored === "dark") return stored;
    } catch (error) {
      console.warn("Não foi possível ler a preferência de tema.", error);
    }

    return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }

  function setTheme(theme) {
    const resolvedTheme = theme === "dark" ? "dark" : "light";
    document.documentElement.dataset.theme = resolvedTheme;
    document.documentElement.style.colorScheme = resolvedTheme;

    const toggle = document.querySelector("[data-theme-toggle]");
    if (toggle) {
      const dark = resolvedTheme === "dark";
      toggle.textContent = dark ? "☀️ Modo claro" : "🌙 Modo escuro";
      toggle.setAttribute("aria-label", dark ? "Ativar modo claro" : "Ativar modo escuro");
      toggle.setAttribute("aria-pressed", String(dark));
    }
  }

  function saveTheme(theme) {
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch (error) {
      console.warn("Não foi possível salvar a preferência de tema.", error);
    }
  }

  function setupTheme() {
    setTheme(getStoredTheme());

    const host = document.querySelector(".module-nav, .topbar-inner");
    if (!host) return;

    let toggle = document.querySelector("[data-theme-toggle]");
    if (!toggle) {
      toggle = document.createElement("button");
      toggle.className = "theme-toggle";
      toggle.type = "button";
      toggle.dataset.themeToggle = "true";
      host.append(toggle);
    }

    toggle.addEventListener("click", () => {
      const nextTheme = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
      saveTheme(nextTheme);
      setTheme(nextTheme);
    });
    setTheme(document.documentElement.dataset.theme || getStoredTheme());
  }

  function setupQuiz(quiz) {
    if (quiz.dataset.quizBound === "true") return;
    const questions = Array.from(quiz.querySelectorAll("[data-question]"));
    const submit = quiz.querySelector("[data-quiz-submit]");
    const reset = quiz.querySelector("[data-quiz-reset]");
    const result = quiz.querySelector("[data-quiz-result]");
    if (!questions.length || !submit) return;

    quiz.dataset.quizBound = "true";

    questions.forEach(question => {
      const options = question.querySelectorAll("[data-option]");
      options.forEach(option => {
        option.setAttribute("aria-pressed", "false");
        option.addEventListener("click", () => {
          options.forEach(item => {
            item.classList.remove("is-selected", "is-correct", "is-incorrect", "is-wrong");
            item.removeAttribute("aria-label");
            item.setAttribute("aria-pressed", "false");
          });
          option.classList.add("is-selected");
          option.setAttribute("aria-pressed", "true");
        });
      });
    });

    submit.addEventListener("click", () => {
      let correct = 0;
      let answered = 0;
      questions.forEach(question => {
        const expected = String(question.dataset.answer || "").toLowerCase();
        const selected = question.querySelector("[data-option].is-selected");
        const correctOption = Array.from(question.querySelectorAll("[data-option]")).find(
          option => String(option.dataset.option || "").toLowerCase() === expected
        );
        question.querySelectorAll("[data-option]").forEach(option => {
          option.classList.remove("is-correct", "is-incorrect", "is-wrong");
          option.removeAttribute("aria-label");
        });
        if (!selected) return;
        answered++;
        const ok = String(selected.dataset.option || "").toLowerCase() === expected;
        if (ok) {
          selected.classList.add("is-correct");
          selected.setAttribute("aria-label", "Resposta correta.");
        } else {
          selected.classList.add("is-incorrect");
          selected.setAttribute("aria-label", "Resposta incorreta.");
          if (correctOption) {
            correctOption.classList.add("is-correct");
            correctOption.setAttribute("aria-label", "Resposta correta.");
          }
        }
        if (ok) correct++;
      });

      const total = questions.length;
      const percent = total ? Math.round((correct / total) * 100) : 0;
      if (result) result.textContent = `${correct}/${total} corretas (${percent}%). ${answered < total ? `Respondidas: ${answered}/${total}.` : ""}`.trim();
      quiz.dispatchEvent(new CustomEvent("quiz:completed", { bubbles: true, detail: { correct, total, answered, percent } }));
    });

    if (reset) {
      reset.addEventListener("click", () => {
        questions.forEach(question => {
          question.querySelectorAll("[data-option]").forEach(option => {
            option.classList.remove("is-selected", "is-correct", "is-incorrect", "is-wrong");
            option.removeAttribute("aria-label");
            option.setAttribute("aria-pressed", "false");
          });
        });
        if (result) result.textContent = "";
      });
    }
  }

  function init() {
    setupTheme();
    document.querySelectorAll("[data-quiz]").forEach(setupQuiz);
  }
  window.CourseQuiz = { init, setupQuiz };
  document.addEventListener("DOMContentLoaded", init);
})();
