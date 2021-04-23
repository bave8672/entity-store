import { EntityStore } from "./entityStore";
import { EntityStoreConfig, Id } from "./type";

/**
 * Provides a singleton reference from which other classes can request access to multiple stores
 */
export class EntityStoreFactory {
    private readonly stores: Map<Id, EntityStore<any>> = new Map<
        string,
        EntityStore<any>
    >();

    /**
     * Gets a store corresponding to a given config, constructing a new sore if necessary
     * @param config The config object for the required store
     * @returns The instance of the requested store contained within this factory instance
     */
    public getStore<T>(config: EntityStoreConfig<T>): EntityStore<T> {
        let store: EntityStore<T> | undefined = this.stores.get(config.key);
        if (store === undefined) {
            store = new EntityStore<T>(config);
            this.stores.set(config.key, store);
        }
        return store;
    }
}
