/*
  Как устроен сайт — это можно легко объяснить на защите проекта:
  1. В data.js лежат 4 предмета и все учебные материалы.
  2. renderHome() берёт эти данные и создаёт интерактивные карточки-плитки.
  3. openTopic(id) заполняет карточку-шпаргалку: правило, шаги алгоритма, пример и ошибку.
  4. openTest() открывает экран проверки: генерирует вопрос и варианты ответов.
  5. selectAnswer(index) запоминает, какую кнопку выбрал ученик.
  6. checkAnswer() сравнивает выбор с правильным ответом (correctIndex), 
     подсвечивает кнопки цветом и выводит понятное объяснение.
  7. showScreen(id) плавно переключает экраны без перезагрузки страницы (SPA).
*/

// Текущее состояние приложения
var state = {
  subjectId: null,
  selected: null,
  checked: false
};

// Плавное переключение между тремя экранами
function showScreen(screenId) {
  var screens = document.querySelectorAll(".screen");
  var opened = null;

  screens.forEach(function (screen) {
    var isOpen = screen.id === screenId;
    screen.hidden = !isOpen;
    if (isOpen) {
      opened = screen;
      // Перезапускаем анимацию появления
      screen.classList.remove("is-active");
      void screen.offsetWidth; // форсируем перерисовку
      screen.classList.add("is-active");
    }
  });

  window.scrollTo({ top: 0, behavior: "smooth" });

  if (opened) {
    var heading = opened.querySelector("h2");
    if (heading) {
      heading.setAttribute("tabindex", "-1");
      heading.focus({ preventScroll: true });
    }
  }
}

// Поиск предмета в списке data.js по id
function findSubject(id) {
  return subjects.find(function (item) {
    return item.id === id;
  });
}

// Главный экран: создаем карточки предметов из данных
function renderHome() {
  var list = document.getElementById("subject-list");
  list.innerHTML = "";

  subjects.forEach(function (item) {
    var card = document.createElement("button");
    card.type = "button";
    card.className = "subject-card subject-card--" + item.id;

    // Контейнер иконки со светлым фоном
    var iconWrap = document.createElement("div");
    iconWrap.className = "subject-card__icon-wrap";

    var icon = document.createElement("img");
    icon.src = item.icon;
    icon.alt = "";
    icon.width = 44;
    icon.height = 44;
    iconWrap.appendChild(icon);

    // Текстовая часть карточки
    var text = document.createElement("div");
    text.className = "subject-card__text";

    var name = document.createElement("span");
    name.className = "subject-card__name";
    name.textContent = item.name;

    var topic = document.createElement("span");
    topic.className = "subject-card__topic";
    topic.textContent = item.topic;

    var footer = document.createElement("div");
    footer.className = "subject-card__footer";
    footer.innerHTML = '<span class="subject-card__cta">Открыть тему</span><span class="subject-card__arrow">→</span>';

    text.appendChild(name);
    text.appendChild(topic);
    text.appendChild(footer);

    card.appendChild(iconWrap);
    card.appendChild(text);

    card.addEventListener("click", function () {
      openTopic(item.id);
    });

    list.appendChild(card);
  });
}

// Экран темы: заполняем шпаргалку выбранного предмета
function openTopic(id) {
  var subject = findSubject(id);
  state.subjectId = id;
  document.body.dataset.subject = id;

  document.getElementById("topic-icon").src = subject.icon;
  document.getElementById("topic-subject").textContent = subject.name;
  document.getElementById("topic-title").textContent = subject.topic;
  document.getElementById("topic-rule").textContent = subject.rule;
  document.getElementById("topic-example").textContent = subject.example;
  document.getElementById("topic-mistake").textContent = subject.mistake;

  // Формируем стильный список шагов алгоритма
  var steps = document.getElementById("topic-steps");
  steps.innerHTML = "";
  subject.steps.forEach(function (step) {
    var item = document.createElement("li");
    item.className = "step-item";
    item.textContent = step;
    steps.appendChild(item);
  });

  showScreen("screen-topic");
}

// Экран теста: подготавливаем вопрос и варианты
function openTest() {
  var subject = findSubject(state.subjectId);
  state.selected = null;
  state.checked = false;

  document.getElementById("test-kicker").textContent = subject.name;
  document.getElementById("test-question").textContent = subject.question;
  document.getElementById("test-hint").textContent = "";
  
  var resultBanner = document.getElementById("test-result");
  resultBanner.hidden = true;
  resultBanner.className = "result-banner";

  var options = document.getElementById("test-options");
  options.innerHTML = "";

  subject.options.forEach(function (text, index) {
    var button = document.createElement("button");
    button.type = "button";
    button.className = "option";
    button.dataset.index = String(index);

    // Буквенный маркер А, Б, В для наглядности
    var letters = ["А", "Б", "В"];
    var marker = document.createElement("span");
    marker.className = "option__marker";
    marker.textContent = letters[index] || String(index + 1);

    var label = document.createElement("span");
    label.className = "option__label";
    label.textContent = text;

    button.appendChild(marker);
    button.appendChild(label);
    options.appendChild(button);
  });

  var checkBtn = document.getElementById("check-answer");
  checkBtn.disabled = false;
  checkBtn.classList.remove("is-active");

  showScreen("screen-test");
}

// Выбор одного варианта ответа
function selectAnswer(index) {
  if (state.checked) {
    return;
  }

  state.selected = index;
  document.getElementById("test-hint").textContent = "";

  var buttons = document.querySelectorAll(".option");
  buttons.forEach(function (button) {
    var isChosen = Number(button.dataset.index) === index;
    button.classList.toggle("is-chosen", isChosen);
    button.setAttribute("aria-pressed", isChosen ? "true" : "false");
  });

  // Активируем кнопку проверки
  var checkBtn = document.getElementById("check-answer");
  checkBtn.classList.add("is-active");
}

// Проверка ответа и вывод подробного объяснения
function checkAnswer() {
  var subject = findSubject(state.subjectId);

  if (state.selected === null) {
    document.getElementById("test-hint").textContent = "Выбери один из вариантов перед проверкой 👇";
    return;
  }

  if (state.checked) {
    return;
  }

  state.checked = true;
  var isRight = state.selected === subject.correctIndex;
  var result = document.getElementById("test-result");
  var title = document.getElementById("result-title");
  var text = document.getElementById("result-text");

  result.hidden = false;
  result.className = isRight 
    ? "result-banner result-banner--ok animate-slide-up" 
    : "result-banner result-banner--bad animate-slide-up";
  
  title.textContent = isRight ? "Отлично! Всё правильно 🎉" : "Не совсем так 🤔";
  text.textContent = subject.explanation;

  // Окрашиваем варианты ответа
  document.querySelectorAll(".option").forEach(function (button) {
    var index = Number(button.dataset.index);
    button.disabled = true;
    if (index === subject.correctIndex) {
      button.classList.add("option--right");
    } else if (index === state.selected) {
      button.classList.add("option--wrong");
    }
  });

  var checkBtn = document.getElementById("check-answer");
  checkBtn.disabled = true;
  checkBtn.classList.remove("is-active");

  // Мягко скроллим к результату, чтобы ученик сразу прочитал разбор
  result.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

// Возврат на главный экран
function goHome() {
  state.subjectId = null;
  state.selected = null;
  state.checked = false;
  document.body.dataset.subject = "";
  showScreen("screen-home");
}

// Привязка слушателей событий к кнопкам навигации
function bindControls() {
  document.getElementById("topic-home").addEventListener("click", goHome);
  document.getElementById("to-test").addEventListener("click", openTest);
  document.getElementById("test-home").addEventListener("click", goHome);
  document.getElementById("test-topic").addEventListener("click", function () {
    openTopic(state.subjectId);
  });
  document.getElementById("check-answer").addEventListener("click", checkAnswer);
  document.getElementById("result-topic").addEventListener("click", function () {
    openTopic(state.subjectId);
  });
  document.getElementById("result-home").addEventListener("click", goHome);

  // Делегирование клика по вариантам ответов
  document.getElementById("test-options").addEventListener("click", function (event) {
    var button = event.target.closest(".option");
    if (!button) {
      return;
    }
    selectAnswer(Number(button.dataset.index));
  });
}

// Запуск приложения
renderHome();
bindControls();
showScreen("screen-home");
