const DEFAULT_BASE_URL = "https://api.gestorvet.com/api.php";
const DEFAULT_TIMEOUT_MS = 30_000;
const CLIENT_PAGE_SIZE = 100;

export type GestorVetJson =
  | null
  | boolean
  | number
  | string
  | GestorVetJson[]
  | { [key: string]: GestorVetJson };

export type GestorVetRecord = Record<string, GestorVetJson>;

export interface GestorVetCredentials {
  apiKey: string;
  noc: string;
}

export interface GestorVetClientOptions {
  baseUrl?: string;
  fetch?: typeof globalThis.fetch;
  timeoutMs?: number;
}

export interface GestorVetClientWrite {
  name: string;
  taxId?: string;
  statusId?: 1 | 2;
  address?: string;
  postalCode?: string;
  populationId?: string | number;
  provinceId?: string | number;
  deferredPayment?: boolean;
  globalDiscount?: string | number;
  clientGroupId?: string | number;
  notes?: string;
  contactName?: string;
  landline?: string;
  mobile?: string;
  email?: string;
  noEmail?: boolean;
  allowSms?: boolean;
  allowEmail?: boolean;
  blockCommunications?: boolean;
  communicationCampaign?: boolean;
  createVerified?: boolean;
}

export interface GestorVetPetWrite {
  clientId: string | number;
  medicalRecordNumber?: string;
  status?: 1 | 2;
  name: string;
  microchip?: string;
  passport?: string;
  sexId?: 3 | 4;
  birthDate?: string;
  speciesId: string | number;
  breedId?: string | number;
  temperamentId?: string | number;
  affinityDegree?: number;
  neutered?: boolean;
  coat?: string;
  habitat?: string;
  usualVetId?: string | number;
  notes?: string;
  clinicalIncompatibilities?: string;
}

export interface GestorVetAppointmentWrite {
  clientId: string | number;
  petId: string | number;
  consultationReasonId: string | number;
  date: string;
  time: string;
  description?: string;
  creatorUserId: string | number;
  assignedUserId: string | number;
  centerId?: string | number;
  locationId?: string | number;
}

export class GestorVetApiError extends Error {
  readonly endpoint: string;
  readonly status?: number;

  constructor(message: string, endpoint: string, status?: number) {
    super(message);
    this.name = "GestorVetApiError";
    this.endpoint = endpoint;
    this.status = status;
  }
}

function requiredSecret(value: string, label: string): string {
  const trimmed = value.trim();
  if (!trimmed) throw new Error(`Missing GestorVet ${label}`);
  return trimmed;
}

function pathSegment(value: string | number): string {
  return encodeURIComponent(String(value));
}

function isRecord(value: GestorVetJson | undefined): value is GestorVetRecord {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/**
 * GestorVet does not document a stable response envelope. This normalizer
 * accepts a direct array, common envelope keys, a numerically keyed object,
 * or a single record without coupling the integration to one guessed shape.
 */
export function recordsFromGestorVet(payload: GestorVetJson): GestorVetRecord[] {
  if (Array.isArray(payload)) return payload.filter(isRecord);
  if (!isRecord(payload)) return [];

  const envelopeKeys = [
    "data",
    "result",
    "results",
    "items",
    "clientes",
    "mascotas",
    "agenda",
    "consumos",
    "vacunaciones",
    "desparasitaciones",
    "pesos",
  ];

  for (const key of envelopeKeys) {
    const value = payload[key];
    if (Array.isArray(value)) return value.filter(isRecord);
    if (isRecord(value)) {
      const nested = Object.values(value);
      if (nested.length > 0 && nested.every(isRecord)) return nested;
    }
  }

  const values = Object.values(payload);
  if (values.length > 0 && values.every(isRecord)) return values;
  return [payload];
}

export class GestorVetClient {
  private readonly apiKey: string;
  private readonly noc: string;
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof globalThis.fetch;
  private readonly timeoutMs: number;

  constructor(credentials: GestorVetCredentials, options: GestorVetClientOptions = {}) {
    this.apiKey = requiredSecret(credentials.apiKey, "API key");
    this.noc = requiredSecret(credentials.noc, "NOC");
    this.baseUrl = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/$/, "");
    this.fetchImpl = options.fetch ?? globalThis.fetch;
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  }

  static fromEnvironment(options?: GestorVetClientOptions): GestorVetClient {
    return new GestorVetClient(
      {
        apiKey: process.env.GESTORVET_API_KEY ?? "",
        noc: process.env.GESTORVET_NOC ?? "",
      },
      options,
    );
  }

  async getClients(
    filters: { id?: string | number; name?: string; statusId?: 0 | 1 | 2; page?: number } = {},
  ): Promise<GestorVetRecord[]> {
    const payload = await this.get("getclientes", [
      filters.id ?? 0,
      filters.name ?? 0,
      filters.statusId ?? 0,
      filters.page ?? 0,
    ]);
    return recordsFromGestorVet(payload);
  }

  async getAllClients(maxPages = 10_000): Promise<GestorVetRecord[]> {
    const clients: GestorVetRecord[] = [];
    let previousPageSignature: string | null = null;

    for (let page = 0; page < maxPages; page += 1) {
      const current = await this.getClients({ page });
      if (current.length === 0) break;

      const signature = JSON.stringify(current);
      if (signature === previousPageSignature) break;
      previousPageSignature = signature;
      clients.push(...current);

      if (current.length < CLIENT_PAGE_SIZE) break;
    }

    return clients;
  }

  async getClient(id: string | number): Promise<GestorVetRecord[]> {
    return recordsFromGestorVet(await this.get("getclientesespecifico", [id, 0]));
  }

  async getPets(
    filters: {
      id?: string | number;
      name?: string;
      status?: 0 | 1 | 2;
      clientId?: string | number;
    } = {},
  ): Promise<GestorVetRecord[]> {
    return recordsFromGestorVet(
      await this.get("getmascotas", [
        filters.id ?? 0,
        filters.name ?? 0,
        filters.status ?? 0,
        filters.clientId ?? 0,
      ]),
    );
  }

  async getPet(id: string | number): Promise<GestorVetRecord[]> {
    return recordsFromGestorVet(await this.get("getmascotasespecifico", [id, 0, 0, 0]));
  }

  async getAppointments(
    filters: {
      clientId?: string | number;
      userId?: string | number;
      centerId?: string | number;
    } = {},
  ): Promise<GestorVetRecord[]> {
    return recordsFromGestorVet(
      await this.get("getagenda", [
        filters.clientId ?? 0,
        filters.userId ?? 0,
        filters.centerId ?? 0,
      ]),
    );
  }

  async getConsumptions(
    filters: {
      id?: string | number;
      invoiceNumber?: string;
      clientId?: string | number;
      specific?: boolean;
    } = {},
  ): Promise<GestorVetRecord[]> {
    return recordsFromGestorVet(
      await this.get(filters.specific ? "getconsumosespecifico" : "getconsumos", [
        filters.id ?? 0,
        filters.invoiceNumber ?? 0,
        filters.clientId ?? 0,
      ]),
    );
  }

  async getVaccinations(petId: string | number): Promise<GestorVetRecord[]> {
    return recordsFromGestorVet(await this.get("getvacunaciones", [petId, 0]));
  }

  async getDewormings(petId: string | number): Promise<GestorVetRecord[]> {
    return recordsFromGestorVet(await this.get("getdesparasitaciones", [petId, 0]));
  }

  async getWeights(petId: string | number): Promise<GestorVetRecord[]> {
    return recordsFromGestorVet(await this.get("getpesosmascota", [petId]));
  }

  async getSpecies(): Promise<GestorVetRecord[]> {
    return recordsFromGestorVet(await this.get("getespecies", [0, 0]));
  }

  async getBreeds(): Promise<GestorVetRecord[]> {
    return recordsFromGestorVet(await this.get("getrazas", [0, 0]));
  }

  async getUsers(): Promise<GestorVetRecord[]> {
    return recordsFromGestorVet(await this.get("getusuarios", [0, 0]));
  }

  async getConsultationReasons(): Promise<GestorVetRecord[]> {
    return recordsFromGestorVet(await this.get("getmotivosconsulta", [0, 0, 0]));
  }

  async getCenters(): Promise<GestorVetRecord[]> {
    return recordsFromGestorVet(await this.get("getmulticentros", [0, 0]));
  }

  async getLocations(centerId: string | number = 0): Promise<GestorVetRecord[]> {
    return recordsFromGestorVet(await this.get("getubicaciones", [0, 0, centerId]));
  }

  async getClinicData(): Promise<GestorVetRecord[]> {
    return recordsFromGestorVet(await this.get("getdatosclinica", [0, 0]));
  }

  async createClient(input: GestorVetClientWrite): Promise<GestorVetJson> {
    return this.post("setcrearcliente", this.clientForm(input));
  }

  async updateClient(id: string | number, input: GestorVetClientWrite): Promise<GestorVetJson> {
    return this.post("setactualizarcliente", {
      ...this.clientForm(input),
      ID: id,
    });
  }

  async createPet(input: GestorVetPetWrite): Promise<GestorVetJson> {
    return this.post("setcrearmascota", {
      CLIENTE: input.clientId,
      NHC: input.medicalRecordNumber ?? "",
      ESTADO: input.status ?? 1,
      NOMBRE: input.name,
      CHIP_TATUAJE: input.microchip ?? "",
      PASAPORTE: input.passport ?? "",
      SEXO: input.sexId ?? "",
      NACIMIENTO: input.birthDate ?? "",
      ESPECIE: input.speciesId,
      RAZA: input.breedId ?? "",
      CARACTER: input.temperamentId ?? "",
      GRADO_AFINIDAD: input.affinityDegree ?? "",
      CASTRADO: input.neutered ? "on" : "",
      CAPA: input.coat ?? "",
      HABITAT: input.habitat ?? "",
      VETERINARIO: input.usualVetId ?? "",
      OBSERVACIONES: input.notes ?? "",
      INCOMPATIBILIDADES: input.clinicalIncompatibilities ?? "",
      NOC: this.noc,
    });
  }

  async createAppointment(input: GestorVetAppointmentWrite): Promise<GestorVetJson> {
    return this.post("setcrearcita", {
      CLIENTE: input.clientId,
      MASCOTA: input.petId,
      MOTIVO: input.consultationReasonId,
      fecha: input.date,
      HORA: input.time,
      DESCRIPCION: input.description ?? "",
      CREADOR: input.creatorUserId,
      DESTINATARIO: input.assignedUserId,
      CENTRO: input.centerId ?? 0,
      NOC: this.noc,
      UBICACION: input.locationId ?? 0,
    });
  }

  private clientForm(input: GestorVetClientWrite): Record<string, string | number> {
    return {
      NOMBRE: input.name,
      CIF: input.taxId ?? "",
      ESTADO_ID: input.statusId ?? 1,
      DIRECCION: input.address ?? "",
      CP: input.postalCode ?? "",
      POBLACION: input.populationId ?? "",
      PROVINCIA: input.provinceId ?? "",
      ADMITE_PAGO_DIFERIDO: input.deferredPayment ? "on" : "",
      DESCUENTO_GLOBAL: input.globalDiscount ?? "",
      TIPO_CLIENTE_ID: input.clientGroupId ?? "",
      OBSERVACIONES: input.notes ?? "",
      CONTACTO1: input.contactName ?? input.name,
      TLF_CONTACTO1: input.landline ?? "",
      MOVIL_CONTACTO1: input.mobile ?? "",
      EMAIL_CONTACTO1: input.email ?? "",
      NO_EMAIL_CONTACTO1: input.noEmail ? "on" : "",
      ENVIAR_SMS_CONTACTO1: input.allowSms ? "on" : "",
      ENVIAR_EMAIL_CONTACTO1: input.allowEmail ? "on" : "",
      SOLICITA_LOPD_CONTACTO1: input.blockCommunications ? "on" : "",
      CAMPANA_COMUNICACION_CONTACTO1: input.communicationCampaign ? "on" : "",
      VERIFICACION_CREACION: input.createVerified === false ? 0 : 1,
      NOC: this.noc,
    };
  }

  private async get(endpoint: string, parameters: (string | number)[]): Promise<GestorVetJson> {
    const segments = [endpoint, this.apiKey, this.noc, ...parameters].map(pathSegment).join("/");
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await this.fetchImpl(`${this.baseUrl}/${segments}`, {
        method: "GET",
        headers: { Accept: "application/json" },
        cache: "no-store",
        redirect: "error",
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new GestorVetApiError(
          `GestorVet request failed with HTTP ${response.status}`,
          endpoint,
          response.status,
        );
      }

      const text = await response.text();
      if (!text.trim()) return [];

      try {
        return JSON.parse(text) as GestorVetJson;
      } catch {
        throw new GestorVetApiError(
          "GestorVet returned a non-JSON response",
          endpoint,
          response.status,
        );
      }
    } catch (error) {
      if (error instanceof GestorVetApiError) throw error;
      if (error instanceof Error && error.name === "AbortError") {
        throw new GestorVetApiError("GestorVet request timed out", endpoint);
      }
      throw new GestorVetApiError("GestorVet network request failed", endpoint);
    } finally {
      clearTimeout(timeout);
    }
  }

  private async post(
    endpoint: string,
    fields: Record<string, string | number>,
  ): Promise<GestorVetJson> {
    const body = new URLSearchParams();
    for (const [key, value] of Object.entries(fields)) {
      body.set(key, String(value));
    }

    return this.request(endpoint, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
      },
      body: body.toString(),
    });
  }

  private async request(endpoint: string, init: RequestInit): Promise<GestorVetJson> {
    const segments = [endpoint, this.apiKey, this.noc].map(pathSegment).join("/");
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await this.fetchImpl(`${this.baseUrl}/${segments}`, {
        ...init,
        cache: "no-store",
        redirect: "error",
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new GestorVetApiError(
          `GestorVet request failed with HTTP ${response.status}`,
          endpoint,
          response.status,
        );
      }

      const text = await response.text();
      if (!text.trim()) return [];

      try {
        return JSON.parse(text) as GestorVetJson;
      } catch {
        throw new GestorVetApiError(
          "GestorVet returned a non-JSON response",
          endpoint,
          response.status,
        );
      }
    } catch (error) {
      if (error instanceof GestorVetApiError) throw error;
      if (error instanceof Error && error.name === "AbortError") {
        throw new GestorVetApiError("GestorVet request timed out", endpoint);
      }
      throw new GestorVetApiError("GestorVet network request failed", endpoint);
    } finally {
      clearTimeout(timeout);
    }
  }
}
