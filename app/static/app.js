import { photoOperation, removePhoto, clearPhotos } from "./photos.js";
import {
  TRAITS,
  answerKey,
  emptyState,
  profile,
  knowledge,
  shipPhysics,
} from "./core.js";

const html = (strings, ...values) =>
  strings.reduce(
    (text, part, index) => text + part + (values[index] ?? ""),
    "",
  );

const app = document.querySelector("#app");
const notice = document.querySelector("#notice");
const STORE = "torfyanoe-trail-v1";
const esc = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        char
      ],
  );
const action = (name, label, extra = "", style = "primary") =>
  `<button class="${style}" data-action="${name}" ${extra}>${label}</button>`;
const image = (name, alt = "", cls = "") =>
  `<img class="${cls}" src="/static/media/${esc(name)}.svg" alt="${esc(alt)}" loading="lazy">`;
let stations = [],
  state = emptyState(),
  current = null,
  selectedPart = null,
  drag = null;
let timers = new Map(),
  timerInterval;
let tg;
function connectTelegram() {
  tg = window.Telegram?.WebApp;
  if (!tg) return;
  try {
    tg.ready();
    tg.expand();
    tg.setHeaderColor?.("#F4F7F8");
    tg.setBackgroundColor?.("#F4F7F8");
    tg.BackButton?.onClick(() =>
      navigate(location.hash === "#route" ? "" : "#route"),
    );
    if (location.hash) tg.BackButton?.show();
  } catch {
    /* The browser version remains usable if the SDK rejects a call. */
  }
}
connectTelegram();
document
  .querySelector("#telegram-sdk")
  ?.addEventListener("load", connectTelegram);
function message(text) {
  notice.hidden = false;
  notice.textContent = text;
}
function persist() {
  try {
    localStorage.setItem(STORE, JSON.stringify(state));
  } catch {
    message(
      "Браузер не разрешил сохранить прогресс. В этой вкладке всё работает; после закрытия ответы могут исчезнуть.",
    );
  }
}
function restore() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORE) || "null");
    if (saved?.version === 1) {
      state = emptyState();
      for (const key of ["answers", "revealed", "ships", "photos"])
        if (
          saved[key] &&
          typeof saved[key] === "object" &&
          !Array.isArray(saved[key])
        )
          state[key] = saved[key];
      if (Array.isArray(saved.completed))
        state.completed = [
          ...new Set(
            saved.completed.filter((id) =>
              stations.some((s) => s.id === id && s.status === "active"),
            ),
          ),
        ];
      for (const s of active()) {
        const placements = state.ships[s.id];
        if (
          !placements ||
          typeof placements !== "object" ||
          Array.isArray(placements)
        )
          state.ships[s.id] = {};
        for (const block of s.blocks) {
          const key = answerKey(s, block),
            value = state.answers[key];
          if (
            block.type === "true_false" &&
            (!value || typeof value !== "object" || Array.isArray(value))
          )
            delete state.answers[key];
          if (
            ["checklist", "visual_quiz"].includes(block.type) &&
            !Array.isArray(value)
          )
            delete state.answers[key];
          if (
            ["choice", "profile_choice"].includes(block.type) &&
            !block.options.some((option) => option.id === value)
          )
            delete state.answers[key];
        }
        if (!Array.isArray(state.revealed[s.id])) state.revealed[s.id] = [];
        state.revealed[s.id] = state.revealed[s.id].filter((id) =>
          s.blocks.some((b) => b.id === id),
        );
      }
      state.completed = state.completed.filter((id) =>
        readyToFinish(stations.find((s) => s.id === id)),
      );
    }
  } catch {
    message(
      "Сохранённый прогресс не удалось прочитать. Можно начать прогулку заново.",
    );
  }
}
const active = () => stations.filter((s) => s.status === "active");
const complete = () => active().every((s) => state.completed.includes(s.id));
function haptic() {
  try {
    tg?.HapticFeedback?.selectionChanged();
  } catch {}
}
function navigate(hash) {
  if (location.hash === hash) render();
  else location.hash = hash;
}
function nextButton(block) {
  return block.next_block_id
    ? action(
        "next",
        `${esc(block.next_label || "Читать дальше")} <span>→</span>`,
        `data-next="${esc(block.next_block_id)}"`,
      )
    : action("finish", "Завершить станцию <span>✓</span>");
}
function render() {
  clearInterval(timerInterval);
  const hash = location.hash.slice(1);
  current = stations.find(
    (s) => hash === `station/${s.id}` && s.status === "active",
  );
  if (current) renderStation();
  else if (hash.startsWith("done/"))
    renderDone(stations.find((s) => s.id === hash.slice(5)));
  else if (hash === "result") renderResult();
  else if (hash === "route") renderRoute();
  else renderHome();
  try {
    if (hash) tg?.BackButton?.show();
    else tg?.BackButton?.hide();
  } catch {}
  app.focus({ preventScroll: true });
  window.scrollTo({ top: 0, behavior: "instant" });
  updateTimers();
  timerInterval = setInterval(updateTimers, 1000);
}
function renderHome() {
  const done = state.completed.length;
  app.innerHTML = html`<section class="home">
    <p class="eyebrow">Полевой дневник · Владивосток</p>
    <h1>Больше,<br />чем прогулка.</h1>
    <p class="lead">
      Озеро Торфяное. 10 маленьких исследований о большом мире
      вокруг.
    </p>
    <div class="hero">
      ${image("landscape", "Условный пейзаж озера и прибрежных сопок")}<span
        class="hero-tag"
        >СМОТРИ БЛИЖЕ</span
      ><span class="hero-note"> Озеро. Природа. Люди. </span>
    </div>
    <div class="stats">
      <div><b>${active().length}</b><span>открытых станций</span></div>
      <div><b>35–50</b><span>минут на задания</span></div>
    </div>
    ${action(
      "route",
      `${done ? "Продолжить прогулку" : "Начать исследование"} <span>↗</span>`,
    )}
    ${done
      ? `<p class="muted">Пройдено ${done} из ${active().length}. Ответы сохранены на этом устройстве.</p>`
      : ""}
    <div class="intro-grid">
      <h2>Сначала заметить.<br />Потом понять.</h2>
      <p>
        Найди хвою, загляни в микромир, собери корабль. По пути выбирай то, что
        тебе ближе, и узнай, кто ты из биома озера в конце!
      </p>
    </div>
    <details>
      <summary>Небольшое напоминание!</summary>
      <p>
        Держись дорожек, не заходи в воду, не ломай ветки и не тревожь животных.
        Помни, что разжигать костры, курить, употреблять алкогольные напитки и мусорить здесь запрещено.
        Давай вместе сохранять наше удивительное озеро! 
      </p>
    </details>
    ${action("reset", "Начать заново", "", "text-button")}
  </section>`;
}
function routeSvg() {
  const coordinates = stations.map((station) => station.coordinates);
  const latitudes = coordinates.map((point) => point[0]);
  const longitudes = coordinates.map((point) => point[1]);
  const minLat = Math.min(...latitudes),
    maxLat = Math.max(...latitudes);
  const minLon = Math.min(...longitudes),
    maxLon = Math.max(...longitudes);
  const xy = coordinates.map(([lat, lon]) => [
    60 + ((lon - minLon) / (maxLon - minLon || 1)) * 240,
    70 + ((maxLat - lat) / (maxLat - minLat || 1)) * 240,
  ]);
  return html`<svg
    viewBox="0 0 360 385"
    class="route-map"
    role="img"
    aria-label="Условная схема расположения станций"
  >
    <rect width="360" height="385" fill="#E7EEF0" />
    <path
      d="M166 65C252 75 213 117 245 161S227 253 191 302 104 277 119 216 85 148 125 97Z"
      fill="#9AB1B8"
    />
    <path d="M24 362 Q180 325 349 369L360 385H0Z" fill="#5F7F86" />
    <text x="158" y="188" fill="#2F3337" font-size="14">ОЗЕРО</text>
    <text x="145" y="207" fill="#2F3337" font-size="14">ТОРФЯНОЕ</text>
    <path
      d="M${xy.map((p) => p.join(",")).join("L")}"
      fill="none"
      stroke="#5F7F86"
      stroke-width="2"
      stroke-dasharray="4 6"
    />
    ${stations
      .map((s, index) => {
        const p = xy[index];
        if (!p) return "";
        const locked = s.status !== "active";
        return html`<g
          ${locked
            ? ""
            : `role="button" tabindex="0" data-action="station" data-id="${esc(s.id)}" aria-label="Станция ${s.number}: ${esc(s.title)}"`}
          class="map-pin ${locked ? "locked" : ""}"
          ><circle
            cx="${p[0]}"
            cy="${p[1]}"
            r="22"
            fill="${locked ? "#D9DEE2" : "#2F3337"}"
            stroke="#fff"
            stroke-width="3"
          /><text
            x="${p[0]}"
            y="${p[1] + 5}"
            text-anchor="middle"
            fill="${locked ? "#68777C" : "#fff"}"
            font-size="14"
            >${state.completed.includes(s.id) ? "✓" : s.number}</text
          ></g
        >`;
      })
      .join("")}
    <text x="20" y="27" font-size="11" fill="#50676E">
      · СХЕМА ·
    </text>
    <text x="325" y="26" font-size="12">С ↑</text>
  </svg>`;
}
function renderRoute() {
  const k = knowledge(stations, state);
  app.innerHTML = html`<p class="eyebrow">Твой маршрут</p>
    <h1 class="page-title">У каждого места<br />своя история.</h1>
    <p class="lead">
      Иди в удобном порядке. Открыты ${active().length} станций из
      ${stations.length}.
    </p>
    <div class="progress-label">
      <span>${state.completed.length} / ${active().length} пройдено</span
      ><span>${k.score} / ${k.total} открытий</span>
    </div>
    <progress
      max="${active().length}"
      value="${state.completed.length}"
    ></progress>
    ${routeSvg()}
    <p class="caption">
      Расположение ориентировочное. На местности находи QR-коды и стенды - это станции квеста!
    </p>
    <div class="station-list">
      ${stations
        .map(
          (s) =>
            `<button class="station-card ${s.status === "locked" ? "locked" : ""}" data-action="station" data-id="${esc(s.id)}" ${s.status === "locked" ? "disabled" : ""}><span class="station-number">${String(s.number).padStart(2, "0")}</span><span><small>${esc(s.kicker || "Скоро на маршруте")}</small><b>${esc(s.title)}</b><small>${state.completed.includes(s.id) ? "✓ Пройдено · можно вернуться" : esc(s.minutes || "Станция готовится")}</small></span><span>↗</span></button>`,
        )
        .join("")}
    </div>
    <div class="result-teaser">
      ${image("butterfly", "", "teaser-icon")}
      <p class="eyebrow">Твой характер озера</p>
      <h2>Кто ты из биома?</h2>
      <p>
        ${complete()
          ? "Все станции пройдены. Пора познакомиться с собой."
          : `Откроется после ${active().length} доступных станций. Будущих ждать не нужно.`}
      </p>
      ${action(
        "result",
        "Узнать свой образ <span>→</span>",
        complete() ? "" : "disabled",
      )}
    </div>`;
}
function renderStation() {
  const s = current;
  if (!state.revealed[s.id]?.length) state.revealed[s.id] = [s.blocks[0].id];
  if (state.completed.includes(s.id))
    state.revealed[s.id] = s.blocks.map((b) => b.id);
  const icon =
    { 1: "lake", 3: "micro", 5: "pine", 8: "ship", 10: "dragonfly" }[
      s.number
    ] || "lake";
  app.innerHTML = html`${action("route", "← Все станции", "", "text-button")}
    <div class="station-head">
      <p class="eyebrow">
        Станция ${String(s.number).padStart(2, "0")} · ${esc(s.minutes)}
      </p>
      <h1 class="page-title">${esc(s.title)}</h1>
      <div class="station-art">
        ${image(icon, "Иллюстрация темы станции")}
        <p>${esc(s.kicker)}</p>
      </div>
    </div>
    ${s.blocks
      .map(
        (b, i) =>
          `<section class="block" id="block-${esc(b.id)}" data-block="${esc(b.id)}" ${state.revealed[s.id].includes(b.id) ? "" : "hidden"}><div class="block-label">${String(i + 1).padStart(2, "0")} / ${String(s.blocks.length).padStart(2, "0")} <span>${esc(b.eyebrow || blockLabel(b.type))}</span></div><h2>${esc(b.title)}</h2>${b.intro ? `<p class="intro">${esc(b.intro)}</p>` : ""}${renderBlock(s, b)}</section>`,
      )
      .join("")}
    ${s.sources?.length
      ? `<details class="sources"><summary>Откуда эти знания</summary>${s.sources.map((x) => `<p><a href="${esc(x.url)}" target="_blank" rel="noopener noreferrer">${esc(x.title)} ↗</a></p>`).join("")}</details>`
      : ""}`;
  restorePhotos();
}
function blockLabel(type) {
  return {
    story: "История",
    checklist: "Наблюдение",
    profile_choice: "Твой характер",
    choice: "Твой выбор",
    visual_quiz: "Микрозагадка",
    ship_builder: "Эксперимент",
    true_false: "Проверь открытия",
    observation: "Полевые заметки",
  }[type];
}
function renderBlock(s, b) {
  const key = answerKey(s, b),
    answer = state.answers[key];
  if (b.type === "story")
    return html`<p class="opening">${esc(b.opening)}</p>
      <div class="article">
        ${b.content
          .map((x) =>
            x.type === "fact"
              ? `<aside><h3>${esc(x.title)}</h3><p>${esc(x.text)}</p></aside>`
              : `<p>${esc(x.text)}</p>`,
          )
          .join("")}
      </div>
      ${nextButton(b)}`;
  if (["choice", "profile_choice"].includes(b.type)) {
    const selected = b.options.find((o) => o.id === answer);
    return html`<div class="options">
        ${b.options
          .map(
            (o, i) =>
              `<button class="option ${answer === o.id ? "selected" : ""}" data-action="choice" data-value="${esc(o.id)}" aria-pressed="${answer === o.id}"><span class="option-letter">${String.fromCharCode(65 + i)}</span><span><b>${esc(o.title)}</b><small>${esc(o.summary)}</small></span><span class="tick">${answer === o.id ? "✓" : "+"}</span></button>`,
          )
          .join("")}
      </div>
      <div data-feedback aria-live="polite">
        ${selected
          ? `${b.type === "choice" ? `<aside><h3>Что даёт этот выбор</h3><p>${esc(selected.gain)}</p><h3>Компромисс</h3><p>${esc(selected.risk)}</p><p>${esc(selected.best_for)}</p></aside>` : '<p class="saved">✓ Ответ сохранён. Можно передумать: баллы пересчитаются.</p>'}${nextButton(b)}`
          : ""}
      </div>`;
  }
  if (b.type === "observation")
    return html`<ol>
        ${b.levels.map((t) => `<li>${esc(t)}</li>`).join("")}
      </ol>
      <h3>${esc(b.question)}</h3>
      <div class="options">
        ${b.answers
          .map(
            (o, i) =>
              `<button class="option ${answer === i ? "selected" : ""}" data-action="observe" data-index="${i}" aria-pressed="${answer === i}">${esc(o)}</button>`,
          )
          .join("")}
      </div>
      ${Number.isInteger(answer)
        ? `<aside>${esc(b.feedback)}</aside>${nextButton(b)}`
        : ""}`;
  if (b.type === "checklist") {
    const found = Array.isArray(answer) ? answer : [];
    return `${b.timer ? `<div class="timer"><span data-timer="${esc(key)}">01:00</span>${action("timer", "Засечь минуту", "", "secondary")}<small>Таймер необязателен — переход открыт сразу.</small></div>` : ""}<div class="${b.photo ? "hunt-grid" : "options"}">${b.options.map((o) => `<div class="hunt-item">${o.image ? referenceImage(o.image) : ""}<button class="option ${found.includes(o.id) ? "selected" : ""}" data-action="check" data-value="${esc(o.id)}" aria-pressed="${found.includes(o.id)}"><span class="checkbox">${found.includes(o.id) ? "✓" : ""}</span><span><b>${esc(o.title)}</b><small>${esc(o.summary || "")}</small></span></button>${b.photo ? `<div class="photo-area"><label class="photo-button">+ Моё фото<input type="file" accept="image/*"  data-photo="${esc(key + ":" + o.id)}"></label><img data-photo-preview="${esc(key + ":" + o.id)}" alt="Моя находка" hidden><button class="text-button" data-action="delete-photo" data-photo-key="${esc(key + ":" + o.id)}" ${state.photos[key + ":" + o.id] ? "" : "hidden"}>Удалить фото</button></div>` : ""}</div>`).join("")}</div><p class="muted">${b.photo ? "Фото сохраняются только на этом устройстве. Не нашёл растение? Можно продолжить без отметок." : "Отмечай только то, что видел. Нулевой результат тоже важен."}</p>${nextButton(b)}`;
  }
  if (b.type === "visual_quiz") {
    const submitted = Array.isArray(answer);
    return html`<div class="visual-grid">
        ${b.options
          .map(
            (o, i) =>
              `<button class="visual-option ${submitted && answer.includes(o.id) ? "selected" : ""}" data-action="visual" data-value="${esc(o.id)}" aria-pressed="${submitted && answer.includes(o.id)}" ${submitted ? "disabled" : ""}>${image(["heliozoan", "ciliate", "fantasy", "diatom"][i], o.title)}<b>${esc(o.title)}</b><small>${submitted ? (o.is_real ? "Природный прототип" : "Выдуманный герой") : "Нажми, чтобы отметить"}</small></button>`,
          )
          .join("")}
      </div>
      ${submitted
        ? `<aside><h3>Разбор</h3>${b.options.map((o) => `<p><b>${esc(o.title)}.</b> ${esc(o.answer_text)}</p>`).join("")}</aside>${nextButton(b)}`
        : action("submit-visual", "Проверить ответ <span>→</span>")}`;
  }
  if (b.type === "true_false")
    return html`<div class="quiz">
        ${b.questions
          .map((q, i) => {
            const a = answer?.[i],
              done = typeof a === "boolean";
            return html`<article class="quiz-item">
              <span class="eyebrow">${i + 1} / ${b.questions.length}</span>
              <h3>${esc(q.text)}</h3>
              <div class="binary">
                ${[true, false]
                  .map((value) =>
                    action(
                      "truth",
                      value ? "Правда" : "Ложь",
                      `data-index="${i}" data-value="${value}" ${done ? "disabled" : ""} aria-pressed="${a === value}"`,
                      a === value ? "secondary selected" : "secondary",
                    ),
                  )
                  .join("")}
              </div>
              ${done
                ? `<p class="quiz-explanation"><b>${a === q.answer ? "Верно · +1 открытие" : "Ответ: " + (q.answer ? "правда" : "ложь")}.</b> ${esc(q.explanation)}</p>`
                : ""}
            </article>`;
          })
          .join("")}
      </div>
      ${b.questions.every((_, i) => typeof answer?.[i] === "boolean")
        ? nextButton(b)
        : '<p class="muted">Ответь на все пять утверждений — разбор появляется сразу.</p>'}`;
  if (b.type === "ship_builder") return renderShip(s, b);
  return "";
}
const referencePhotos = {
  pine: "https://upload.wikimedia.org/wikipedia/commons/3/3d/Pine_tree_needles_close_up_1.jpg",
  spruce:
    "https://upload.wikimedia.org/wikipedia/commons/1/1e/Picea-abies-needles-buds-2010-02-11.jpg",
  fir: "https://upload.wikimedia.org/wikipedia/commons/3/3a/Abies_grandis_needles.jpg",
  juniper:
    "https://upload.wikimedia.org/wikipedia/commons/2/2b/Juniperus_communis_Finland_2006.jpg",
};
function referenceImage(name) {
  const refs = {
    pine: [
      "Pine_tree_needles_close_up_1.jpg",
      "Robsphotos",
      "4.0",
      "Сосна лучистая: пример пучков хвои",
    ],
    spruce: [
      "Picea-abies-needles-buds-2010-02-11.jpg",
      "Sten Porse",
      "3.0",
      "Ель обыкновенная: одиночные иголки",
    ],
    fir: [
      "Abies_grandis_needles.jpg",
      "Sten Porse",
      "3.0",
      "Пихта великая: плоская хвоя",
    ],
    juniper: [
      "Juniperus_communis_Finland_2006.jpg",
      "Scoo",
      "2.5",
      "Можжевельник обыкновенный: шишкоягоды",
    ],
  };
  const [file, author, license, alt] = refs[name];
  return html`<figure class="reference">
    <img
      src="${referencePhotos[name]}"
      data-fallback="/static/media/${name}.svg"
      alt="${esc(alt)}"
      loading="lazy"
    />
    <figcaption>
      ${esc(alt)}.
      <a
        href="https://commons.wikimedia.org/wiki/File:${encodeURIComponent(
          file,
        )}"
        target="_blank"
        rel="noopener"
        >${esc(author)}</a
      >
      ·
      <a
        href="https://creativecommons.org/licenses/${name === "juniper"
          ? "by"
          : "by-sa"}/${license}/"
        target="_blank"
        rel="noopener"
        >CC ${name === "juniper" ? "BY" : "BY-SA"} ${license}</a
      ><span class="fallback-note" hidden
        >Показана схема признака; фотография недоступна.</span
      >
    </figcaption>
  </figure>`;
}
function renderShip(s, b) {
  const placements = state.ships[s.id] || {},
    result = shipPhysics(b, placements);
  return html`<p class="muted">${esc(b.hint)}</p>
    <div class="ship-metrics">
      <div>
        <small>Масса / предел</small
        ><b>${result.mass} / ${b.physics.base_capacity}</b>
      </div>
      <div>
        <small>Центр тяжести</small
        ><b
          >${result.height <= b.physics.max_center_height
            ? "Низко"
            : "Высоко"}</b
        >
      </div>
      <div>
        <small>Посадка</small
        ><b
          >${Math.abs(result.pitch) <= b.physics.max_pitch
            ? "Ровно"
            : "Перекос"}</b
        >
      </div>
    </div>
    <div class="ship-stage">
      <div class="water"></div>
      <div
        class="hull"
        style="--angle:${Math.max(-8, Math.min(8, result.pitch * 20))}deg"
      >
        <div class="slot-grid">
          ${b.slots
            .map((slot) => {
              const p = b.parts.find((p) => placements[p.id] === slot.id);
              return html`<button
                class="ship-slot"
                data-action="place"
                data-slot="${slot.id}"
                aria-label="${esc(slot.title)}${p
                  ? ": " + esc(p.title)
                  : ": свободно"}"
              >
                <small>${esc(slot.title)}</small><b>${p ? esc(p.code) : "+"}</b>
              </button>`;
            })
            .join("")}
        </div>
      </div>
    </div>
    <p class="caption">
      Вид сбоку. Корма слева, нос справа. Детали по центру ширины корпуса;
      модель показывает продольный баланс.
    </p>
    <div class="ship-parts">
      ${b.parts
        .map(
          (p) =>
            `<button class="ship-part ${selectedPart === p.id ? "selected" : ""}" data-action="part" data-part="${p.id}" aria-pressed="${selectedPart === p.id}"><b>${esc(p.code)}</b><span>${esc(p.title)}<small>${p.weight} ед. ${placements[p.id] ? "· установлено" : ""}</small></span></button>`,
        )
        .join("")}
    </div>
    <p class="muted">
      ${selectedPart
        ? "Выбрано: " +
          esc(b.parts.find((p) => p.id === selectedPart)?.title) +
          ". Нажми отсек. Занятая деталь вернётся в список."
        : "Нажми деталь, затем отсек. Перетаскивание тоже работает."}
    </p>
    ${action("test-ship", "Проверить сборку <span>→</span>")}
    <div data-ship-feedback aria-live="polite"></div>
    <div class="ship-shortcuts">
      ${action(
        "solve-ship",
        "Показать рабочий пример",
        "",
        "secondary",
      )}${action("reset-ship", "Разобрать", "", "text-button")}
    </div>
    <div data-ship-default-next>${nextButton(b)}</div>`;
}
function renderDone(s) {
  if (!s || !state.completed.includes(s.id)) {
    renderRoute();
    return;
  }
  app.innerHTML = html`<div class="completion">
    <div class="done-mark">✓</div>
    <p class="eyebrow">Станция ${s.number} пройдена</p>
    <h1 class="page-title">
      ${esc(s.completion?.title || "Ещё одно открытие")}
    </h1>
    <p class="lead">
      ${esc(s.completion?.text || "Твои наблюдения сохранены.")}
    </p>
    <p>${state.completed.length} из ${active().length} станций</p>
    ${action(
      complete() ? "result" : "route",
      complete()
        ? "Узнать свой характер озера →"
        : "Выбрать следующую станцию →",
    )}${action(
      "station",
      "Вернуться к материалу",
      `data-id="${esc(s.id)}"`,
      "secondary",
    )}
  </div>`;
}
function renderResult() {
  if (!complete()) {
    renderRoute();
    return;
  }
  const p = profile(stations, state),
    k = knowledge(stations, state),
    winner = TRAITS[p.ranking[0].key];
  app.innerHTML = html`<section class="result">
    <p class="eyebrow">Твой характер озера Торфяное</p>
    <div class="result-art">${image(winner.icon, winner.title)}</div>
    <h1 class="page-title">${esc(winner.title)}</h1>
    <p class="lead">${esc(winner.text)}</p>
    ${p.winners.length > 1
      ? `<aside>На равных с тобой: ${p.winners
          .slice(1)
          .map((key) => esc(TRAITS[key].title))
          .join(
            ", ",
          )}. У тебя смешанный образ; первым показан один из равных результатов.</aside>`
      : ""}
    <div class="score-card">
      <b>${k.score} / ${k.total} научных открытий</b
      ><span
        >${p.answered} ответов о характере · ${active().length} станций</span
      >
    </div>
    <h2>Из чего сложился образ</h2>
    <div class="trait-bars">
      ${p.ranking
        .map(
          (r) =>
            `<div><span>${TRAITS[r.key].label}</span><b>${r.raw} / ${r.max}</b><progress value="${r.value}" max="1"></progress></div>`,
        )
        .join("")}
    </div>
    <p class="caption">
      Баллы нормированы на доступный максимум каждой черты. Это игровой портрет
      по твоим выборам, не психологическая диагностика. Знания и скорость
      прохождения на характер не влияют.
    </p>
    ${action("share", "Поделиться результатом ↗")}${action(
      "route",
      "Вернуться к станциям",
      "",
      "secondary",
    )}${action("reset", "Пройти заново", "", "text-button")}
    <div data-share-status aria-live="polite"></div>
  </section>`;
}
function refreshBlock(block, focusAction) {
  const section = app.querySelector(`[data-block="${block.id}"]`);
  const top = window.scrollY;
  // Replace only this block so timer, scroll position and neighbouring controls stay stable.
  section.innerHTML = html`<div class="block-label">
      ${String(current.blocks.indexOf(block) + 1).padStart(2, "0")} /
      ${String(current.blocks.length).padStart(2, "0")}
      <span>${esc(block.eyebrow || blockLabel(block.type))}</span>
    </div>
    <h2>${esc(block.title)}</h2>
    ${block.intro
      ? `<p class="intro">${esc(block.intro)}</p>`
      : ""}${renderBlock(current, block)}`;
  window.scrollTo({ top, behavior: "instant" });
  if (focusAction)
    section.querySelector(focusAction)?.focus({ preventScroll: true });
  restorePhotos();
  updateTimers();
}
function reveal(id) {
  if (!current.blocks.some((b) => b.id === id)) return;
  if (!state.revealed[current.id].includes(id))
    state.revealed[current.id].push(id);
  persist();
  const section = app.querySelector(`#block-${id}`);
  section.hidden = false;
  section.scrollIntoView({
    behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
      ? "instant"
      : "smooth",
    block: "start",
  });
  section.tabIndex = -1;
  section.focus({ preventScroll: true });
}
function readyToFinish(s) {
  return s.blocks.every((b) => {
    const a = state.answers[answerKey(s, b)];
    if (["choice", "profile_choice"].includes(b.type))
      return b.options.some((o) => o.id === a);
    if (b.type === "observation")
      return Number.isInteger(a) && a >= 0 && a < b.answers.length;
    if (b.type === "true_false")
      return b.questions.every((_, i) => typeof a?.[i] === "boolean");
    if (b.type === "visual_quiz") return Array.isArray(a);
    return state.revealed[s.id]?.includes(b.id);
  });
}
app.addEventListener("keydown", (e) => {
  if (e.target.matches('g[role="button"]') && ["Enter", " "].includes(e.key)) {
    e.preventDefault();
    e.target.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  }
});
document.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-action]");
  if (!button || button.disabled) return;
  const type = button.dataset.action;
  if (["home", "route", "result"].includes(type)) {
    navigate(type === "home" ? "" : `#${type}`);
    return;
  }
  if (type === "station") {
    selectedPart = null;
    navigate(`#station/${button.dataset.id}`);
    return;
  }
  if (type === "reset") {
    if (confirm("Удалить ответы и фото с этого устройства и начать заново?")) {
      await clearPhotos();
      state = emptyState();
      persist();
      navigate("");
    }
    return;
  }
  if (type === "share") {
    const p = profile(stations, state),
      text = `Мой характер озера — ${TRAITS[p.ranking[0].key].title}. ЭкоТропа · Торфяное, Патрокл.`;
    try {
      if (navigator.share)
        await navigator.share({
          title: "ЭкоТропа · Торфяное",
          text,
          url: location.origin,
        });
      else {
        await navigator.clipboard.writeText(text + " " + location.origin);
        app.querySelector("[data-share-status]").textContent =
          "Текст и ссылка скопированы.";
      }
    } catch (e) {
      if (e.name !== "AbortError")
        app.querySelector("[data-share-status]").textContent =
          text + " " + location.origin;
    }
    return;
  }
  const section = button.closest("[data-block]"),
    block = current?.blocks.find((b) => b.id === section?.dataset.block);
  if (!block) return;
  const key = answerKey(current, block);
  if (type === "next") {
    reveal(button.dataset.next);
    return;
  }
  if (type === "finish") {
    if (!readyToFinish(current)) {
      message("Сначала закончи задания выше: выбери ответы и посмотри разбор.");
      return;
    }
    if (!state.completed.includes(current.id)) state.completed.push(current.id);
    persist();
    haptic();
    navigate(`#done/${current.id}`);
    return;
  }
  if (type === "choice") {
    state.answers[key] = button.dataset.value;
    persist();
    refreshBlock(block, `[data-value="${button.dataset.value}"]`);
    haptic();
  }
  if (type === "observe") {
    state.answers[key] = Number(button.dataset.index);
    persist();
    refreshBlock(block, `[data-index="${button.dataset.index}"]`);
  }
  if (type === "check") {
    let found = Array.isArray(state.answers[key])
      ? [...state.answers[key]]
      : [];
    const id = button.dataset.value,
      option = block.options.find((o) => o.id === id);
    found = found.includes(id)
      ? found.filter((x) => x !== id)
      : option.exclusive
        ? [id]
        : [
            ...found.filter(
              (x) => !block.options.find((o) => o.id === x)?.exclusive,
            ),
            id,
          ];
    state.answers[key] = found;
    persist();
    refreshBlock(block, `[data-value="${id}"]`);
  }
  if (type === "visual") {
    button.classList.toggle("selected");
    button.setAttribute("aria-pressed", button.classList.contains("selected"));
  }
  if (type === "submit-visual" && !Array.isArray(state.answers[key])) {
    state.answers[key] = [
      ...section.querySelectorAll(".visual-option.selected"),
    ].map((b) => b.dataset.value);
    persist();
    refreshBlock(block);
  }
  if (type === "truth") {
    const answers =
        state.answers[key] && typeof state.answers[key] === "object"
          ? state.answers[key]
          : {},
      index = Number(button.dataset.index);
    if (typeof answers[index] === "boolean") return;
    answers[index] = button.dataset.value === "true";
    state.answers[key] = answers;
    persist();
    refreshBlock(block);
    haptic();
  }
  if (type === "timer") {
    timers.set(key, Date.now() + block.timer * 1000);
    updateTimers();
  }
  if (type === "part") {
    selectedPart = button.dataset.part;
    refreshBlock(block, `[data-part="${selectedPart}"]`);
  }
  if (type === "place") placePart(block, button.dataset.slot);
  if (type === "reset-ship") {
    state.ships[current.id] = {};
    selectedPart = null;
    persist();
    refreshBlock(block);
  }
  if (type === "solve-ship") {
    state.ships[current.id] = { ...block.solution };
    selectedPart = null;
    persist();
    refreshBlock(block);
    shipFeedback(block, true);
  }
  if (type === "test-ship") shipFeedback(block);
  if (type === "delete-photo") {
    await removePhoto(button.dataset.photoKey);
    delete state.photos[button.dataset.photoKey];
    persist();
    refreshBlock(block);
  }
});
function placePart(block, slot) {
  if (!selectedPart) {
    message("Сначала выбери деталь под судном.");
    return;
  }
  const placements = state.ships[current.id] || {};
  Object.keys(placements).forEach((id) => {
    if (placements[id] === slot) delete placements[id];
  });
  placements[selectedPart] = slot;
  state.ships[current.id] = placements;
  selectedPart = null;
  persist();
  refreshBlock(block);
  haptic();
}
function shipFeedback(block, example = false) {
  app.querySelector("[data-ship-default-next]").hidden = true;
  const result = shipPhysics(block, state.ships[current.id] || {}),
    target = app.querySelector("[data-ship-feedback]");
  target.innerHTML = html`<aside>
    <h3>
      ${example
        ? "Рабочий пример"
        : result.problems.length
          ? "Судно пока не готово"
          : "Сборка устойчива"}
    </h3>
    ${result.problems.length
      ? `<ul>${result.problems.map((p) => `<li>${esc(p)}</li>`).join("")}</ul><p><b>Можно читать дальше прямо сейчас.</b> В статье разберём, почему судно плавает. Или нажми «Показать рабочий пример» ниже.</p>`
      : "<p>Тяжёлые двигатель, груз и балласт стоят в трюме; масса распределена вдоль корпуса. Это один из вариантов в учебной модели.</p>"}${nextButton(
      block,
    )}
  </aside>`;
  target.scrollIntoView({ behavior: "smooth", block: "nearest" });
}
function updateTimers() {
  app.querySelectorAll("[data-timer]").forEach((el) => {
    const deadline = timers.get(el.dataset.timer);
    if (!deadline) return;
    const remaining = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
    el.textContent = remaining
      ? `${String(Math.floor(remaining / 60)).padStart(2, "0")}:${String(remaining % 60).padStart(2, "0")}`
      : "Минута наблюдения прошла";
  });
}
// Pointer events keep drag usable on touch screens. Tapping remains the accessible default.
app.addEventListener("pointerdown", (event) => {
  const part = event.target.closest("[data-part]");
  if (!part || event.button > 0) return;
  drag = {
    id: part.dataset.part,
    startX: event.clientX,
    startY: event.clientY,
    pointer: event.pointerId,
    element: part,
    moved: false,
  };
  part.setPointerCapture(event.pointerId);
});
app.addEventListener("pointermove", (event) => {
  if (!drag || drag.pointer !== event.pointerId) return;
  if (Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) > 8)
    drag.moved = true;
  if (drag.moved) {
    drag.element.style.transform = `translate(${event.clientX - drag.startX}px,${event.clientY - drag.startY}px)`;
    drag.element.classList.add("dragging");
  }
});
app.addEventListener("pointerup", (event) => {
  if (!drag) return;
  const session = drag;
  drag = null;
  session.element.style.transform = "";
  session.element.classList.remove("dragging");
  if (!session.moved) return;
  event.preventDefault();
  const slot = document
    .elementFromPoint(event.clientX, event.clientY)
    ?.closest("[data-slot]");
  const block = current.blocks.find((b) => b.type === "ship_builder");
  if (slot && block) {
    selectedPart = session.id;
    placePart(block, slot.dataset.slot);
  }
});
app.addEventListener("pointercancel", () => {
  if (drag) {
    drag.element.style.transform = "";
    drag.element.classList.remove("dragging");
    drag = null;
  }
});
async function restorePhotos() {
  for (const img of app.querySelectorAll("[data-photo-preview]")) {
    if (!state.photos[img.dataset.photoPreview]) continue;
    try {
      const blob = await photoOperation("readonly", (store) =>
        store.get(img.dataset.photoPreview),
      );
      if (blob && img.isConnected) {
        const url = URL.createObjectURL(blob);
        img.src = url;
        img.hidden = false;
        img.onload = () => URL.revokeObjectURL(url);
      }
    } catch {
      message(
        "Фото недоступны в этом браузере. Отметки и задания работают без них.",
      );
    }
  }
}
app.addEventListener("change", async (event) => {
  const input = event.target.closest("[data-photo]");
  if (!input?.files?.[0]) return;
  const file = input.files[0];
  if (file.size > 25 * 1024 * 1024) {
    message("Выбери фотографию меньше 25 МБ.");
    return;
  }
  try {
    const url = URL.createObjectURL(file),
      img = new Image();
    try {
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
        img.src = url;
      });
    } finally {
      URL.revokeObjectURL(url);
    }
    const scale = Math.min(1, 1200 / Math.max(img.width, img.height)),
      canvas = document.createElement("canvas");
    canvas.width = Math.round(img.width * scale);
    canvas.height = Math.round(img.height * scale);
    canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.8),
    );
    if (!blob) throw Error("No image");
    await photoOperation("readwrite", (store) =>
      store.put(blob, input.dataset.photo),
    );
    state.photos[input.dataset.photo] = true;
    persist();
    const section = input.closest("[data-block]");
    if (section && current) {
      refreshBlock(current.blocks.find((b) => b.id === section.dataset.block));
    }
  } catch {
    message(
      "Фото не удалось сохранить. Попробуй JPG/PNG из галереи. Задание можно пройти без фото.",
    );
  }
});
app.addEventListener(
  "error",
  (event) => {
    if (event.target.dataset.fallback) {
      event.target.src = event.target.dataset.fallback;
      delete event.target.dataset.fallback;
      const note = event.target
        .closest("figure")
        ?.querySelector(".fallback-note");
      if (note) note.hidden = false;
    }
  },
  true,
);
window.addEventListener("hashchange", render);
window.addEventListener("offline", () =>
  message("Нет сети. Уже сохранённые станции и твои ответы доступны."),
);
window.addEventListener("online", () => {
  notice.hidden = true;
});
async function boot() {
  try {
    const response = await fetch("/api/route");
    if (!response.ok) throw Error("route");
    const data = await response.json();
    stations = data.stations;
    restore();
    render();
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js")
        .then(() => navigator.serviceWorker.ready)
        .then(() => {
          const el = document.querySelector("#offline-status");
          if (el)
            el.textContent =
              "✓ Статьи, схемы и задания сохранены для повторного открытия без сети. Первая загрузка в Telegram всё равно может требовать интернет.";
        })
        .catch(() => {});
    }
  } catch {
    app.innerHTML = html`<h1 class="page-title">Маршрут пока не загрузился</h1>
      <p>
        Проверь интернет и попробуй ещё раз. Твои сохранённые ответы не удалены.
      </p>
      <button class="primary" id="retry">Повторить</button>`;
    document.querySelector("#retry").onclick = boot;
  }
}
boot();
