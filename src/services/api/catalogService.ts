import type { Card, SpecialAbilityInfo } from '@/types/card.types';
import { apiFetch } from './http';

/** Server card document (snake_case). */
export interface ServerCard {
  _id: string;
  nombre: string;
  tipo: Card['tipo'];
  fuerza: number;
  coste: number;
  historia: string;
  habilidad: string;
  bonus_fuerza: number | null;
  raza: string | null;
  special_abilities: string[];
  tipo_sello: string;
  rareza: string;
  expansion: string | null;
  ilustrador: string;
  cantidad_edicion: number;
  numero_carta: number;
  image_url: string;
  categoria: string | null;
  available_to_common: boolean;
}

export function toCard(raw: ServerCard): Card {
  return {
    id: raw._id,
    nombre: raw.nombre,
    tipo: raw.tipo,
    fuerza: raw.fuerza,
    coste: raw.coste,
    historia: raw.historia,
    habilidad: raw.habilidad,
    imagen: raw.image_url,
    ilustrador: raw.ilustrador,
    cantidadEdicion: raw.cantidad_edicion,
    numeroCarta: raw.numero_carta,
    tipoSello: raw.tipo_sello,
    rareza: raw.rareza as Card['rareza'],
    bonusFuerza: raw.bonus_fuerza ?? undefined,
    raza: raw.raza ?? undefined,
    habilidadesEspeciales: raw.special_abilities,
    expansion: raw.expansion ?? undefined,
  };
}

export interface CardFormData {
  nombre: string;
  tipo: Card['tipo'];
  fuerza: number;
  coste: number;
  historia: string;
  habilidad: string;
  bonusFuerza?: number;
  habilidadesEspeciales: string[];
  imageUrl: string;
  /** Nº de la carta dentro de su edición (p.ej. 35 en "HC-35/160") */
  numeroCarta: number;
  /** Total de cartas de la edición (p.ej. 160) */
  cantidadEdicion: number;
  /** Código de la serie/expansión (p.ej. "HC") */
  expansion: string;
  /** Raza del aliado (p.ej. "Patriota", "Caudillo") */
  raza: string;
}

function toServerPayload(data: CardFormData) {
  return {
    nombre: data.nombre,
    tipo: data.tipo,
    fuerza: data.fuerza,
    coste: data.coste,
    historia: data.historia,
    habilidad: data.habilidad,
    ...(data.bonusFuerza !== undefined ? { bonus_fuerza: data.bonusFuerza } : {}),
    special_abilities: data.habilidadesEspeciales,
    image_url: data.imageUrl,
    numero_carta: data.numeroCarta,
    cantidad_edicion: data.cantidadEdicion,
    ...(data.expansion.trim() ? { expansion: data.expansion.trim() } : {}),
    ...(data.raza.trim() ? { raza: data.raza.trim() } : {}),
  };
}

interface ServerAbility {
  _id: string;
  code: string;
  nombre: string;
  descripcion: string;
  implemented: boolean;
  categoria?: 'especial' | 'carta';
  tipos?: Card['tipo'][];
}

interface UploadSignature {
  cloud_name: string;
  api_key: string;
  timestamp: number;
  folder: string;
  signature: string;
}

async function uploadToCloudinary(sig: UploadSignature, file: Blob): Promise<string> {
  const form = new FormData();
  form.append('file', file);
  form.append('api_key', sig.api_key);
  form.append('timestamp', String(sig.timestamp));
  form.append('folder', sig.folder);
  form.append('signature', sig.signature);

  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${sig.cloud_name}/image/upload`,
    { method: 'POST', body: form },
  );
  if (!res.ok) throw new Error('Error subiendo la imagen a Cloudinary');
  const json = (await res.json()) as { secure_url: string };
  return json.secure_url;
}

export const apiCatalogService = {
  /** "Cartas disponibles": the backend filters by role. */
  async listAvailable(): Promise<Card[]> {
    return (await apiFetch<ServerCard[]>('/api/cards')).map(toCard);
  },

  async createCard(data: CardFormData): Promise<Card> {
    return toCard(
      await apiFetch<ServerCard>('/api/cards', { method: 'POST', body: toServerPayload(data) }),
    );
  },

  async updateCard(id: string, data: CardFormData): Promise<Card> {
    return toCard(
      await apiFetch<ServerCard>(`/api/cards/${id}`, {
        method: 'PATCH',
        body: toServerPayload(data),
      }),
    );
  },

  async deleteCard(id: string): Promise<void> {
    await apiFetch(`/api/cards/${id}`, { method: 'DELETE' });
  },

  /** Signed direct upload of a card image; returns the Cloudinary URL. */
  async uploadCardImage(file: Blob): Promise<string> {
    const sig = await apiFetch<UploadSignature>('/api/cards/upload-signature', {
      method: 'POST',
    });
    return uploadToCloudinary(sig, file);
  },

  /**
   * Upload a card image to the user's Google Drive through the backend
   * (15 GB free vs 1 GB in Cloudinary). Returns a hotlinkable URL.
   * Throws ApiError 503 when Drive is not configured in server/.env.
   */
  async uploadCardImageToDrive(file: Blob): Promise<string> {
    const formData = new FormData();
    formData.append('file', file, 'card.jpg');
    const { url } = await apiFetch<{ url: string }>('/api/uploads/drive-card', {
      method: 'POST',
      body: formData,
    });
    return url;
  },

  async uploadBoardImage(file: Blob): Promise<string> {
    const sig = await apiFetch<UploadSignature>('/api/uploads/board-signature', {
      method: 'POST',
    });
    return uploadToCloudinary(sig, file);
  },

  async listAbilities(): Promise<SpecialAbilityInfo[]> {
    const raw = await apiFetch<ServerAbility[]>('/api/special-abilities');
    return raw.map((a) => ({
      id: a._id,
      code: a.code,
      nombre: a.nombre,
      descripcion: a.descripcion,
      implemented: a.implemented,
      categoria: a.categoria ?? 'especial',
      tipos: a.tipos ?? [],
    }));
  },

  async createAbility(data: {
    code: string;
    nombre: string;
    descripcion: string;
    categoria: 'especial' | 'carta';
    tipos: Card['tipo'][];
  }): Promise<SpecialAbilityInfo> {
    const a = await apiFetch<ServerAbility>('/api/special-abilities', {
      method: 'POST',
      body: data,
    });
    return {
      id: a._id,
      code: a.code,
      nombre: a.nombre,
      descripcion: a.descripcion,
      implemented: a.implemented,
      categoria: a.categoria ?? 'especial',
      tipos: a.tipos ?? [],
    };
  },
};
