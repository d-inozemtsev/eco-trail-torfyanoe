/** Pure calculations, shared by the UI and regression tests. */
export const TRAITS = {
  guardian: {
    title: "Крепкая скала",
    label: "Опора",
    icon: "rock",
    text: "Рядом с тобой легче выдохнуть. Ты умеешь держать слово, беречь своих и не терять почву под ногами. Твоя сила — устойчивость, а не громкость. Иногда разрешай себе менять маршрут: даже самый надёжный берег меняется под действием моря.",
  },
  explorer: {
    title: "Лёгкая на подъём бабочка",
    label: "Открытость",
    icon: "butterfly",
    text: "Тебя оживляет возможность увидеть новое. Ты легко подхватываешь идеи, пробуешь и замечаешь красивые повороты пути. Твоя сила — любопытство. Иногда задержись у одной находки: глубина бывает не менее удивительной, чем следующий горизонт.",
  },
  observer: {
    title: "Внимательная цапля",
    label: "Внимание",
    icon: "heron",
    text: "Ты замечаешь тихие сигналы: движение у воды, чужое настроение, важную деталь. Умеешь выдержать паузу и составить собственное мнение. Твоя сила — наблюдательность. Не обязательно ждать идеального момента, чтобы сделать первый шаг.",
  },
  strategist: {
    title: "Точная стрекоза",
    label: "Замысел",
    icon: "dragonfly",
    text: "Ты видишь цель и прикидываешь путь к ней. Любишь понимать устройство вещей и превращать сложную задачу в последовательность шагов. Твоя сила — ясность. Оставляй место случайным открытиям: не всё интересное помещается в план.",
  },
  connector: {
    title: "Тёплая сосна",
    label: "Связь",
    icon: "pine",
    text: "Ты создаёшь ощущение «мы». Рядом с тобой людям проще познакомиться, поделиться находкой и включиться в общее дело. Твоя сила — объединять. Сохраняй время и для себя: забота о других не требует быть доступным каждую минуту.",
  },
};
export const answerKey = (station, block) => `${station.id}:${block.id}`;
export const emptyState = () => ({
  version: 1,
  completed: [],
  answers: {},
  revealed: {},
  ships: {},
  photos: {},
});
export function profile(stations, state) {
  const raw = Object.fromEntries(Object.keys(TRAITS).map((k) => [k, 0]));
  const possible = { ...raw };
  let answered = 0;
  for (const station of stations.filter((s) => s.status === "active")) {
    for (const block of station.blocks) {
      if (!["choice", "profile_choice"].includes(block.type)) continue;
      const option = block.options.find(
        (o) => o.id === state.answers[answerKey(station, block)],
      );
      if (!option?.scores) continue;
      answered++;
      for (const key of Object.keys(raw)) {
        raw[key] += option.scores[key] || 0;
        possible[key] += Math.max(
          ...block.options.map((o) => o.scores?.[key] || 0),
        );
      }
    }
  }
  const ranking = Object.keys(raw)
    .map((key) => ({
      key,
      raw: raw[key],
      max: possible[key],
      value: possible[key] ? raw[key] / possible[key] : 0,
    }))
    .sort((a, b) => b.value - a.value);
  return {
    ranking,
    answered,
    winners: ranking
      .filter((r) => Math.abs(r.value - ranking[0].value) < 1e-9)
      .map((r) => r.key),
  };
}
export function knowledge(stations, state) {
  let score = 0,
    total = 0;
  for (const station of stations.filter((s) => s.status === "active"))
    for (const block of station.blocks) {
      const answer = state.answers[answerKey(station, block)];
      if (block.type === "true_false") {
        total += block.questions.length;
        score += block.questions.filter(
          (q, i) => answer?.[i] === q.answer,
        ).length;
      }
      if (block.type === "visual_quiz") {
        total += block.options.length;
        if (Array.isArray(answer))
          score += block.options.filter(
            (o) => answer.includes(o.id) === o.is_real,
          ).length;
      }
    }
  return { score, total };
}
export function shipPhysics(block, placements) {
  const installed = block.parts.filter((p) =>
    block.slots.some((s) => s.id === placements[p.id]),
  );
  const mass =
    block.physics.hull_weight + installed.reduce((sum, p) => sum + p.weight, 0);
  let vertical = -0.15 * block.physics.hull_weight,
    pitch = 0;
  installed.forEach((p) => {
    const slot = block.slots.find((s) => s.id === placements[p.id]);
    vertical += p.weight * (slot.level === "deck" ? 1 : -1);
    pitch += p.weight * slot.x;
  });
  const result = {
    mass,
    load: mass / block.physics.base_capacity,
    height: vertical / mass,
    pitch: pitch / mass,
    installed: installed.length,
  };
  result.problems = [];
  if (installed.length < block.parts.length)
    result.problems.push(
      "Установлены не все детали. Можно посмотреть пример или сразу читать дальше.",
    );
  if (result.load > 1)
    result.problems.push("Вес превысил допустимый для этой модели.");
  if (result.height > block.physics.max_center_height)
    result.problems.push(
      "Центр тяжести высоко. Перенеси тяжёлые детали в трюм.",
    );
  if (Math.abs(result.pitch) > block.physics.max_pitch)
    result.problems.push(
      result.pitch > 0
        ? "Нос перегружен. Перенеси часть веса к корме."
        : "Корма перегружена. Перенеси часть веса к носу.",
    );
  return result;
}
