import { DefaultEntityType, EntityStoreConfig } from "./type";

export const HUMAN_REACTION_TIME = 200; // ms
export const DEFAULT_CACHE_TIME = 600000; // 10 mins

export const DEFAULT_STORE_CONFIG: EntityStoreConfig<DefaultEntityType> = {
    defaultCacheTIme: DEFAULT_CACHE_TIME,
    idAccessor: (entity) => entity.id,
};
