import assert from "node:assert/strict";
import test from "node:test";
import { rankServiceSuggestions } from "./find-service-by-name.ts";

const services = [
  { id: "general", name: "Consulta general" },
  { id: "visit", name: "Visita" },
  { id: "senior", name: "Revisión geriátrica completa" },
];

test("suggests the operational service sharing the most words", () => {
  assert.deepEqual(rankServiceSuggestions(services, "medicina general"), [
    { id: "general", name: "Consulta general" },
  ]);
});

test("returns no invented suggestions when there is no lexical relation", () => {
  assert.deepEqual(rankServiceSuggestions(services, "peluquería"), []);
});
