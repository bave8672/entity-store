import { EntityStore } from "./EntityStore";
import { EntityStoreConfig, YbId } from "./EntityStore.type";

export class EntityStoreFactory {
    private readonly stores: Map<YbId, EntityStore<any>> = new Map<
        string,
        EntityStore<any>
    >();

    public getStore<T>(config: EntityStoreConfig<T>): EntityStore<T> {
        let store: EntityStore<T> | undefined = this.stores.get(config.key);
        if (store === undefined) {
            store = new EntityStore<T>(config);
            this.stores.set(config.key, store);
        }
        return store;
    }
}
