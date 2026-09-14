import assert from "node:assert/strict";
import test from "node:test";
import { isOwnedByOrganization, selectOrganizationContext } from "./organization-context.ts";

const actor = { id: "actor-1", email: "staff@example.test" };
const membership = {
  id: "membership-1",
  clinic_id: "clinic-1",
  role: "recepcion",
  display_name: "Recepción",
  clinics: {
    id: "clinic-1",
    name: "Clínica Demo",
    slug: "clinica-demo",
    status: "active",
  },
};

test("denies an unauthenticated request", () => {
  assert.deepEqual(selectOrganizationContext({ actor: null, memberships: [] }), {
    ok: false,
    code: "UNAUTHENTICATED",
    message: "No autenticado",
  });
});

test("denies an authenticated actor without membership", () => {
  const result = selectOrganizationContext({ actor, memberships: [] });
  assert.equal(result.ok, false);
  assert.equal(result.code, "NO_MEMBERSHIP");
});

test("denies ambiguous memberships", () => {
  const result = selectOrganizationContext({
    actor,
    memberships: [membership, { ...membership, clinic_id: "clinic-2" }],
  });
  assert.equal(result.ok, false);
  assert.equal(result.code, "AMBIGUOUS_MEMBERSHIP");
});

test("denies an inactive clinic or invalid role", () => {
  const inactive = selectOrganizationContext({
    actor,
    memberships: [{ ...membership, clinics: { ...membership.clinics, status: "suspended" } }],
  });
  const invalidRole = selectOrganizationContext({
    actor,
    memberships: [{ ...membership, role: "owner" }],
  });
  assert.equal(inactive.ok, false);
  assert.equal(inactive.code, "INACTIVE_OR_INVALID_ORGANIZATION");
  assert.equal(invalidRole.ok, false);
});

test("returns the sole active server-resolved clinic", () => {
  assert.deepEqual(selectOrganizationContext({ actor, memberships: [membership] }), {
    ok: true,
    context: {
      actor: { id: "actor-1", email: "staff@example.test" },
      organization: { id: "clinic-1", name: "Clínica Demo", slug: "clinica-demo" },
      membership: { id: "membership-1", role: "recepcion", displayName: "Recepción" },
    },
  });
});

for (const objectType of ["client", "patient", "appointment", "conversation"]) {
  test(`accepts a tenant-owned ${objectType} and rejects a foreign ${objectType}`, () => {
    assert.equal(isOwnedByOrganization("clinic-1", { clinic_id: "clinic-1" }), true);
    assert.equal(isOwnedByOrganization("clinic-1", { clinic_id: "clinic-2" }), false);
    assert.equal(isOwnedByOrganization("clinic-1", null), false);
  });
}
