--------------------------------------------------------------------
-- RECEPIA — Migración 0002_telephony.sql (telefonía + cumplimiento)
-- Dominio: Telefonía y cumplimiento regulatorio (Twilio / España)
--
-- Modela:
--   * clinic_regulatory_info  → identidad legal del cliente (= End-User de Twilio), 1:1 con la clínica.
--   * telephony_numbers        → cada número físico comprado, su Regulatory Bundle, coste y facturación.
--
-- Principio Customer vs End-User (España):
--   - Customer = la sociedad de Recepia (constante global de la plataforma, NO en el esquema).
--   - End-User = la clínica que USA el número (clinic_regulatory_info).
--   - Tú compras y pagas el número a Twilio; lo facturas/repercutes al cliente; lo asocias a su clínica.
--
-- Depende de la migración inicial (20260616193323_initial_schema.sql): clinics, clinic_channels,
-- funciones helper set_updated_at() y user_has_role_in_clinic(uuid, clinic_user_role[]),
-- enums clinic_user_role y channel_type (que YA incluye 'phone').
--
-- Ajustes respecto al borrador original (revisión de seguridad, aprobados):
--   * FIX B: sin policy de lectura sobre la tabla base telephony_numbers. El cliente lee
--            EXCLUSIVAMENTE por la vista v_clinic_telephony, que excluye provider_monthly_cost.
--            Así el coste interno nunca es consultable por el admin de la clínica.
--   * FIX A: v_clinic_telephony (security definer) filtra por tenant con user_has_role_in_clinic,
--            y se concede SELECT solo a authenticated. Garantiza aislamiento multi-tenant.
--------------------------------------------------------------------

--------------------------------------------------------------------
-- 1. TIPOS ENUM
--------------------------------------------------------------------

-- Estado del Regulatory Bundle en el proveedor (espeja los estados de Twilio)
create type regulatory_bundle_status as enum (
  'draft',                  -- creado, aún no enviado
  'pending_review',         -- enviado a Twilio/regulador
  'in_review',              -- Twilio revisando
  'twilio_approved',        -- aprobado
  'twilio_rejected',        -- rechazado (ver rejection_reason)
  'provisionally_approved',
  'expired'                 -- caducado, requiere renovación
);

-- Tipo de End-User declarado ante el regulador
create type regulatory_end_user_type as enum ('business', 'individual');

-- Ciclo de vida del número dentro de Recepia
create type telephony_number_status as enum (
  'pending_purchase',       -- decidido pero no comprado aún
  'pending_bundle',         -- comprado, esperando aprobación de bundle
  'active',                 -- operativo y asignado a un canal
  'suspended',              -- pausado (impago, incidencia)
  'released'                -- liberado/devuelto a Twilio
);

-- Modelo de facturación del número al cliente
create type telephony_billing_model as enum (
  'included_in_subscription',  -- coste absorbido en la tarifa Recepia
  'passthrough_line_item',     -- se factura como línea aparte al cliente
  'client_owned'               -- BYON: el cliente trajo su número (futuro)
);


--------------------------------------------------------------------
-- 2. TABLA: clinic_regulatory_info
--    Identidad legal del cliente (= End-User de Twilio).
--    1:1 con la clínica. Reutilizable para todos sus bundles.
--    NO almacena documentos (escrituras, DNI): solo referencias/SIDs.
--------------------------------------------------------------------
create table clinic_regulatory_info (
  clinic_id uuid primary key
    references clinics(id) on delete cascade,

  -- Identidad de la sociedad (End-User business)
  end_user_type       regulatory_end_user_type not null default 'business',
  legal_name          text not null,          -- Razón social exacta
  tax_id              text not null,          -- CIF/NIF de la sociedad
  authorized_rep_name text,                   -- Representante autorizado (España lo pide)

  -- Dirección local (España exige que case con el prefijo del número)
  address_line1   text not null,
  address_line2   text,
  city            text not null,
  region          text not null,              -- Provincia (ej. Tarragona)
  postal_code     text not null,
  country_code    text not null default 'ES', -- ISO 3166-1 alpha-2

  -- Contacto para notificaciones regulatorias
  contact_email   text,
  contact_phone   text,                       -- E.164

  -- Referencias a objetos ya creados en Twilio (evita recrearlos).
  -- IDs, no secretos. Los documentos NO se guardan aquí.
  twilio_end_user_sid       text,             -- IT... (Identity)
  twilio_address_sid        text,             -- AD... (Address)
  supporting_document_sids  jsonb not null default '[]',  -- ['RD...', ...]

  -- Auditoría de verificación documental
  documents_verified_at  timestamptz,
  notes                  text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_updated_at_clinic_regulatory_info
before update on clinic_regulatory_info
for each row execute function set_updated_at();


--------------------------------------------------------------------
-- 3. TABLA: telephony_numbers
--    Un número físico comprado en Twilio, su bundle, coste y facturación.
--    Tú eres el Customer (constante global); el End-User es la clínica.
--------------------------------------------------------------------
create table telephony_numbers (
  id uuid primary key default gen_random_uuid(),

  -- Clínica que USA el número (a quien se lo facturas y asocias)
  clinic_id uuid not null
    references clinics(id) on delete restrict,
  -- RESTRICT: no borres una clínica con un número Twilio vivo sin liberarlo antes.

  -- El número en sí
  phone_number  text not null,                -- E.164, ej. +34977XXXXXX
  provider      text not null default 'twilio',
  provider_sid  text,                          -- PN... (Phone Number SID de Twilio)
  country_code  text not null default 'ES',
  number_type   text,                          -- 'local', 'mobile', 'national'

  -- Regulatory Bundle
  bundle_status         regulatory_bundle_status not null default 'draft',
  twilio_bundle_sid     text,                   -- BU... (Regulatory Bundle SID)
  bundle_submitted_at   timestamptz,
  bundle_approved_at    timestamptz,
  bundle_expires_at     timestamptz,            -- para renovación proactiva
  rejection_reason      text,                   -- si twilio_rejected

  -- Ciclo de vida en Recepia
  status telephony_number_status not null default 'pending_purchase',

  -- Vínculo al canal conversacional (clinic_channels).
  -- El número como RECURSO vive aquí; como CANAL vive en clinic_channels.
  channel_id uuid
    references clinic_channels(id) on delete set null,

  -- Facturación: tú pagas Twilio, repercutes al cliente
  billing_model          telephony_billing_model not null default 'included_in_subscription',
  provider_monthly_cost  numeric(10,2),         -- lo que TE cuesta a ti (EUR) — NO exponer al cliente
  billed_monthly_price   numeric(10,2),         -- lo que le cobras al cliente
  currency               text not null default 'EUR',

  metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (provider, phone_number)               -- un número no se duplica
);

create index on telephony_numbers(clinic_id);
create index on telephony_numbers(status);
create index on telephony_numbers(bundle_expires_at)
  where bundle_status = 'twilio_approved';       -- para cron de renovación proactiva
create index on telephony_numbers(channel_id);

create trigger set_updated_at_telephony_numbers
before update on telephony_numbers
for each row execute function set_updated_at();


--------------------------------------------------------------------
-- 4. RLS
--    Estos datos son sensibles y su ESCRITURA la opera la plataforma
--    (service_role), NO el cliente.
--
--    clinic_regulatory_info: el admin de la clínica LEE su propia info (dato legal suyo).
--    telephony_numbers: sin policy de lectura para el cliente (FIX B). El cliente lee
--                       exclusivamente por la vista v_clinic_telephony (sección 5), que
--                       excluye provider_monthly_cost. Así el coste interno nunca es
--                       consultable directamente sobre la tabla base.
--------------------------------------------------------------------
alter table clinic_regulatory_info enable row level security;
alter table telephony_numbers      enable row level security;

-- LECTURA: admins de la clínica ven su propia info regulatoria
create policy clinic_regulatory_info_admin_read
  on clinic_regulatory_info for select
  using (user_has_role_in_clinic(clinic_id, array['admin']::clinic_user_role[]));

-- telephony_numbers: NINGUNA policy de select/insert/update/delete para usuarios.
-- Con RLS activo y sin policy permisiva, los usuarios normales quedan bloqueados sobre
-- la tabla base; service_role bypassa RLS por diseño (backend de aprovisionamiento).
-- La lectura del cliente va por v_clinic_telephony.


--------------------------------------------------------------------
-- 5. VISTA: v_clinic_telephony
--    Lo que el panel del cliente puede ver. Excluye provider_monthly_cost.
--    Vista security definer con predicado de tenant explícito (FIX A): filtra por
--    user_has_role_in_clinic para garantizar aislamiento multi-tenant, ya que la
--    tabla base no tiene policy de lectura para el cliente.
--------------------------------------------------------------------
create or replace view v_clinic_telephony as
select
  tn.id,
  tn.clinic_id,
  tn.phone_number,
  tn.country_code,
  tn.number_type,
  tn.status,
  tn.bundle_status,
  tn.billing_model,
  tn.billed_monthly_price,   -- lo que el cliente paga: sí
  tn.currency,               -- provider_monthly_cost: NO expuesto
  tn.created_at
from telephony_numbers tn
where user_has_role_in_clinic(tn.clinic_id, array['admin']::clinic_user_role[]);

-- Solo authenticated puede leer la vista; anon obtiene 0 filas (auth.uid() nulo).
grant select on v_clinic_telephony to authenticated;

-- Fin migración telephony.
