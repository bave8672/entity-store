export interface EntityStoreConfig<T, TId extends YbId = YbId> {
    readonly key: YbId;
    readonly idAccessor: (entity: T) => TId;
}

export type YbId = string | number;
