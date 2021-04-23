/**
 * A valid type that can be keyed against
 */
export type Id = string | number;

/**
 * Configuration for an instance of an entity store
 */
export interface EntityStoreConfig<T, TId extends Id = Id> {
    /**
     * The name or ID of a store instance
     */
    readonly key: Id;
    /**
     * Tells the store how to access the unique ID of an entity passed to it
     */
    readonly idAccessor: (entity: T) => TId;
}
