import { EntityStore } from "./entityStore";
import { EntityStoreFactory } from "./entityStoreFactory";
import { EntityStoreFactoryRequest } from "./type";

describe("entity store factory", () => {
    let entityStoreFactory: EntityStoreFactory;

    const MOCK_ENTITY_CONFIG_A: EntityStoreFactoryRequest<any> = {
        idAccessor: (entity): string => entity.id,
        id: "123abc",
    };

    const MOCK_ENTITY_CONFIG_B: EntityStoreFactoryRequest<any> = {
        idAccessor: (entity): string => entity.id,
        id: "789xyz",
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
