(() => {
  "use strict";

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
          options.forEach(item => { item.classList.remove("is-selected"); item.setAttribute("aria-pressed", "false"); });
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
        question.querySelectorAll("[data-option]").forEach(option => option.classList.remove("is-correct", "is-wrong"));
        if (!selected) return;
        answered++;
        const ok = String(selected.dataset.option || "").toLowerCase() === expected;
        selected.classList.add(ok ? "is-correct" : "is-wrong");
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
            option.classList.remove("is-selected", "is-correct", "is-wrong");
            option.setAttribute("aria-pressed", "false");
          });
        });
        if (result) result.textContent = "";
      });
    }
  }

  function init() { document.querySelectorAll("[data-quiz]").forEach(setupQuiz); }
  window.CourseQuiz = { init, setupQuiz };
  document.addEventListener("DOMContentLoaded", init);
})();
