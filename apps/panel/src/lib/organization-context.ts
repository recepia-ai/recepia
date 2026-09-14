export const ORGANIZATION_ROLES = ["admin", "recepcion", "veterinario"] as const;

export type OrganizationRole = (typeof ORGANIZATION_ROLES)[number];

type Actor = {
  id: string;
  email?: string | null;
};

type ClinicRecord = {
  id?: string;
  name?: string | null;
  slug?: string | null;
  status?: string | null;
};

export type OrganizationMembershipRecord = {
  id?: string | null;
  clinic_id?: string | null;
  role?: string | null;
  display_name?: string | null;
  clinics?: ClinicRecord | ClinicRecord[] | null;
};

export type OrganizationContext = {
  actor: {
    id: string;
    email: string | null;
  };
  organization: {
    id: string;
    name: string;
    slug: string;
  };
  membership: {
    id: string;
    role: OrganizationRole;
    displayName: string | null;
  };
};

export type OrganizationContextErrorCode =
  | "UNAUTHENTICATED"
  | "MEMBERSHIP_LOOKUP_FAILED"
  | "NO_MEMBERSHIP"
  | "AMBIGUOUS_MEMBERSHIP"
  | "INACTIVE_OR_INVALID_ORGANIZATION";

export type OrganizationContextResult =
  | { ok: true; context: OrganizationContext }
  | { ok: false; code: OrganizationContextErrorCode; message: string };

export function isOwnedByOrganization(
  organizationId: string,
  record: { clinic_id?: string | null } | null | undefined,
): boolean {
  return Boolean(record && record.clinic_id === organizationId);
}

type OrganizationContextInput = {
  actor: Actor | null;
  memberships: OrganizationMembershipRecord[];
  lookupFailed?: boolean;
};

function singleClinic(value: OrganizationMembershipRecord["clinics"]): ClinicRecord | null {
  if (Array.isArray(value)) return value.length === 1 ? (value[0] ?? null) : null;
  return value ?? null;
}

function isOrganizationRole(value: string | null | undefined): value is OrganizationRole {
  return ORGANIZATION_ROLES.some((role) => role === value);
}

export function selectOrganizationContext(
  input: OrganizationContextInput,
): OrganizationContextResult {
  if (!input.actor) {
    return { ok: false, code: "UNAUTHENTICATED", message: "No autenticado" };
  }
  if (input.lookupFailed) {
    return {
      ok: false,
      code: "MEMBERSHIP_LOOKUP_FAILED",
      message: "No se pudo verificar el acceso a la clínica",
    };
  }
  if (input.memberships.length === 0) {
    return { ok: false, code: "NO_MEMBERSHIP", message: "Sin clínica asignada" };
  }
  if (input.memberships.length !== 1) {
    return {
      ok: false,
      code: "AMBIGUOUS_MEMBERSHIP",
      message: "Hay varias clínicas asignadas y ninguna selección activa inequívoca",
    };
  }

  const membership = input.memberships[0];
  const clinic = membership ? singleClinic(membership.clinics) : null;
  if (
    !membership?.id ||
    !membership.clinic_id ||
    !clinic ||
    clinic.id !== membership.clinic_id ||
    clinic.status !== "active" ||
    !clinic.name ||
    !clinic.slug ||
    !isOrganizationRole(membership.role)
  ) {
    return {
      ok: false,
      code: "INACTIVE_OR_INVALID_ORGANIZATION",
      message: "La clínica asignada no está activa o la membresía no es válida",
    };
  }

  return {
    ok: true,
    context: {
      actor: { id: input.actor.id, email: input.actor.email ?? null },
      organization: {
        id: membership.clinic_id,
        name: clinic.name,
        slug: clinic.slug,
      },
      membership: {
        id: membership.id,
        role: membership.role,
        displayName: membership.display_name ?? null,
      },
    },
  };
}

export async function resolveOrganizationContext(
  client: unknown,
): Promise<OrganizationContextResult> {
  const supabase = client as {
    auth: {
      getUser: () => Promise<{
        data: { user: Actor | null };
        error?: unknown;
      }>;
    };
    from: (table: "clinic_users") => {
      select: (columns: string) => {
        eq: (
          column: "user_id",
          value: string,
        ) => {
          limit: (count: number) => Promise<{
            data: OrganizationMembershipRecord[] | null;
            error?: unknown;
          }>;
        };
      };
    };
  };

  const auth = await supabase.auth.getUser();
  const actor = auth.data.user;
  if (!actor || auth.error) {
    return selectOrganizationContext({ actor: null, memberships: [] });
  }

  const membershipResult = await supabase
    .from("clinic_users")
    .select("id, clinic_id, role, display_name, clinics(id, name, slug, status)")
    .eq("user_id", actor.id)
    .limit(2);

  return selectOrganizationContext({
    actor,
    memberships: membershipResult.data ?? [],
    lookupFailed: Boolean(membershipResult.error),
  });
}
