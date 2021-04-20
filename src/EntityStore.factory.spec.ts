import { EntityStore } from "./EntityStore";
import { EntityStoreFactory } from "./EntityStore.factory";
import { EntityStoreConfig } from "./EntityStore.type";

describe("entity store factory", () => {
    let entityStoreFactory: EntityStoreFactory;

    const MOCK_ENTITY_CONFIG_A: EntityStoreConfig<any> = {
        idAccessor: (entity: any): string => entity.id,
        key: "123abc",
    };

    const MOCK_ENTITY_CONFIG_B: EntityStoreConfig<any> = {
        idAccessor: (entity: any): string => entity.id,
        key: "789xyz",
    };

    beforeEach(() => {
        entityStoreFactory = new EntityStoreFactory();
    });

    it("should resolve individual entity stores", () => {
        const entityStoreA: EntityStore<any> = entityStoreFactory.getStore(
            MOCK_ENTITY_CONFIG_A,
        );
        const entityStoreB: EntityStore<any> = entityStoreFactory.getStore(
            MOCK_ENTITY_CONFIG_B,
        );

        expect(entityStoreA).not.toBe(entityStoreB);
    });

    it("should resolve the same instance each time", () => {
        const instanceA: EntityStore<any> = entityStoreFactory.getStore(
            MOCK_ENTITY_CONFIG_A,
        );
        const instanceB: EntityStore<any> = entityStoreFactory.getStore(
            MOCK_ENTITY_CONFIG_A,
        );

        expect(instanceA).toBe(instanceB);
    });
});
