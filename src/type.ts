/**
 * A valid type that can be keyed against
 */
export type Id = string | number;

export interface DefaultEntityType<TId extends Id = Id> {
    id: TId;
}

/**
 * Configuration for an instance of an entity store
 */
export type EntityStoreConfig<T, TId extends Id = Id> = {
    /**
     * Sets the default cache time in milliseconds
     */
    readonly defaultCacheTIme: number;
    /**
     * Tells the store how to access the unique ID of an entity passed to it
     */
    readonly idAccessor: (entity: T) => TId;
};

export type EntityStoreFactoryRequest<T> = Partial<EntityStoreConfig<T>> & {
    readonly id: Id;
};
