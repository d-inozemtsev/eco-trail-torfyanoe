import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import {
  profile,
  knowledge,
  shipPhysics,
  emptyState,
  answerKey,
} from "../app/static/core.js";
const stations = JSON.parse(
  execFileSync(
    process.env.PYTHON || "python3",
    [
      "-c",
      "import json; from app.stations import load_stations; print(json.dumps(load_stations()))",
    ],
    { cwd: fileURLToPath(new URL("..", import.meta.url)), encoding: "utf8" },
  ),
);
test("changing an answer replaces points instead of farming them", () => {
  const state = emptyState(),
    s = stations[0],
    b = s.blocks[0],
    key = answerKey(s, b);
  state.answers[key] = b.options[0].id;
  const first = profile(stations, state);
  state.answers[key] = b.options[1].id;
  assert.equal(profile(stations, state).answered, 1);
  state.answers[key] = b.options[0].id;
  assert.deepEqual(profile(stations, state), first);
});
test("knowledge is independent of profile and scores first committed answers", () => {
  const state = emptyState(),
    s = stations.find((s) => s.number === 10),
    b = s.blocks.find((b) => b.type === "true_false");
  const before = profile(stations, state);
  state.answers[answerKey(s, b)] = Object.fromEntries(
    b.questions.map((q, i) => [i, q.answer]),
  );
  assert.equal(knowledge(stations, state).score, 5);
  assert.deepEqual(profile(stations, state), before);
});
test("empty and incorrect ship give feedback; solution passes all constraints", () => {
  const b = stations.find((s) => s.number === 8).blocks[0];
  assert.ok(shipPhysics(b, {}).problems.length);
  assert.equal(shipPhysics(b, b.solution).problems.length, 0);
  assert.ok(
    shipPhysics(b, { engine: "deck-bow", cargo: "deck-middle" }).problems
      .length > 1,
  );
});
test("stale or unrecognised answers cannot inject profile scores", () => {
  const state = emptyState();
  state.answers["fake:block"] = { guardian: 1000000 };
  assert.equal(profile(stations, state).answered, 0);
});
test("final profile is deterministic and exposes ties", () => {
  const state = emptyState();
  for (const s of stations.filter((s) => s.status === "active"))
    for (const b of s.blocks.filter((b) =>
      ["choice", "profile_choice"].includes(b.type),
    ))
      state.answers[answerKey(s, b)] = b.options[0].id;
  const p = profile(stations, state);
  assert.equal(p.answered, 5);
  assert.ok(p.winners.length >= 1);
  assert.deepEqual(profile(stations, state), p);
  assert.ok(p.ranking.every((r) => r.value >= 0 && r.value <= 1));
});
