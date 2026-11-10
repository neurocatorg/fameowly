import { getDocumentStore } from "./storage/db";
import {
  AVAILABLE_MODELS,
  IMAGE_MODELS,
  type ModelOption,
  type ModelsConfig,
} from "./models";
import { reasoningLevelsOf } from "./reasoning-levels";

const MODELS_ID = "models";

type ModelsDocument = ModelsConfig & { id: string };

function settings() {
  return getDocumentStore().collection<ModelsDocument>("settings");
}

/**
 * Apply defaults to a raw model entry from JSON config.
 * - `isLocal` defaults to `true` when provider is "local", `false` otherwise
 * - capability flags default to `false`
 * - legacy `pricePer1MTokens` becomes both input and output price
 */
function normalizeModel(raw: ModelOption): ModelOption {
  const legacyPrice = raw.pricePer1MTokens;
  return {
    ...raw,
    isLocal: raw.isLocal ?? (raw.provider === "local"),
    supportsReasoning: raw.supportsReasoning ?? false,
    ...(raw.reasoningLevels && { reasoningLevels: reasoningLevelsOf(raw) }),
    supportsTemperature: raw.supportsTemperature ?? false,
    supportsWebSearch: raw.supportsWebSearch ?? false,
    supportsUrlContext: raw.supportsUrlContext ?? false,
    supportsToolCalling: raw.supportsToolCalling ?? false,
    inputPricePer1M: raw.inputPricePer1M ?? legacyPrice,
    outputPricePer1M: raw.outputPricePer1M ?? legacyPrice,
  };
}

/**
 * Read the models catalogue (server-side only).
 * Falls back to built-in defaults when none is stored.
 */
export async function readModelsConfig(): Promise<ModelsConfig> {
  try {
    const stored = await settings().get(MODELS_ID);
    if (stored) {
      return {
        chatModels:
          (stored.chatModels?.length > 0
            ? stored.chatModels
            : AVAILABLE_MODELS
          ).map(normalizeModel),
        imageModels:
          (stored.imageModels?.length > 0
            ? stored.imageModels
            : IMAGE_MODELS
          ).map(normalizeModel),
      };
    }
  } catch (err) {
    console.error("Failed to read the models catalogue, using defaults:", err);
  }
  return {
    chatModels: AVAILABLE_MODELS.map(normalizeModel),
    imageModels: IMAGE_MODELS.map(normalizeModel),
  };
}

/** Overwrite the models catalogue (server-side only) */
export async function saveModelsConfig(config: ModelsConfig): Promise<void> {
  await settings().upsert({
    id: MODELS_ID,
    chatModels: config.chatModels,
    imageModels: config.imageModels,
  });
}

/** Drop archived models — they must not be offered to anyone, admins included */
export function withoutArchived(config: ModelsConfig): ModelsConfig {
  return {
    chatModels: config.chatModels.filter((m) => !m.archived),
    imageModels: config.imageModels.filter((m) => !m.archived),
  };
}

export async function isArchivedModel(modelId: string): Promise<boolean> {
  const { chatModels, imageModels } = await readModelsConfig();
  return [...chatModels, ...imageModels].some((m) => m.id === modelId && m.archived);
}

/** Strip internal cost fields — only admins may see them */
export function stripPricingForNonAdmin(
  config: ModelsConfig,
  isAdmin: boolean,
): ModelsConfig {
  if (isAdmin) return config;
  const strip = (m: ModelOption): ModelOption => {
    const clone: ModelOption = { ...m };
    delete clone.inputPricePer1M;
    delete clone.outputPricePer1M;
    delete clone.pricePerImage;
    delete clone.pricePer1MTokens;
    return clone;
  };
  return {
    chatModels: config.chatModels.map(strip),
    imageModels: config.imageModels.map(strip),
  };
}
