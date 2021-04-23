import { isObservable, Observable, of } from "rxjs";
import { EntityStore } from "./entityStore";
import { EntityStoreConfig } from "./type";

describe("Entity Store", () => {
    interface MockEntity {
        id: string;
        name: string;
    }

    const MOCK_ENTITY_CONFIG: EntityStoreConfig<MockEntity> = {
        idAccessor: (entity: MockEntity): string => entity.id,
        key: "123abc",
    };

    let store: EntityStore<MockEntity>;

    beforeEach(() => {
        store = new EntityStore(MOCK_ENTITY_CONFIG);
    });

    describe("basic get/set", () => {
        describe("async operations", () => {
            it("should return an unresolved observable for values that have not been set", () => {
                const stream: Observable<MockEntity> = store.get("asxasx");
                stream.subscribe((value: MockEntity) => {
                    throw new Error(`Unexpected value: ${value}`);
                });
                expect(isObservable(stream)).toBe(true);
            });

            it("should resolve a stream with new values as they are set", (done) => {
                const entity: MockEntity = createEntity();
                const stream: Observable<MockEntity> = store.get(entity.id);
                stream.subscribe((value: MockEntity) => {
                    expect(value).toEqual(entity);
                    done();
                });
                store.set(of(entity)).subscribe();
            });

            it("should resolve previously set values", (done) => {
                const entity: MockEntity = createEntity();
                store.set(of(entity)).subscribe();
                store.get(entity.id).subscribe((value: MockEntity) => {
                    expect(value).toEqual(entity);
                    done();
                });
            });

            it("should resolve set values immediately", (done) => {
                const entity: MockEntity = createEntity();
                store.set(of(entity)).subscribe((value: MockEntity) => {
                    expect(value).toEqual(entity);
                    done();
                });
            });
        });

        describe("sync operations", () => {
            it("should resolve a stream with new values as they are set", (done) => {
                const entity: MockEntity = createEntity();
                const stream: Observable<MockEntity> = store.get(entity.id);
                stream.subscribe((value: MockEntity) => {
                    expect(value).toEqual(entity);
                    done();
                });
                store.set(entity);
            });

            it("should resolve previously set values", (done) => {
                const entity: MockEntity = createEntity();
                store.set(entity);
                store.get(entity.id).subscribe((value: MockEntity) => {
                    expect(value).toEqual(entity);
                    done();
                });
            });

            it("should resolve set values immediately", (done) => {
                const entity: MockEntity = createEntity();
                store.set(entity).subscribe((value: MockEntity) => {
                    expect(value).toEqual(entity);
                    done();
                });
            });
        });
    });

    describe("getOrSet", () => {
        describe("async operations", () => {
            it("should set entities if they are not set", (done) => {
                const entity: MockEntity = createEntity();
                const getEntity: () => Observable<MockEntity> = () =>
                    of(entity);
                const stream: Observable<MockEntity> = store.get(entity.id);
                stream.subscribe((value: MockEntity) => {
                    expect(value).toEqual(entity);
                    done();
                });
                store.getOrSet(entity.id, getEntity).subscribe();
            });

            it("should not override previously set entities", (done) => {
                const entity: MockEntity = createEntity();
                const getEntity: () => Observable<MockEntity> = () =>
                    of(entity);
                const stream: Observable<MockEntity> = store.get(entity.id);
                store.getOrSet(entity.id, getEntity).subscribe();
                store
                    .getOrSet(entity.id, () =>
                        of({
                            ...entity,
                            name: Math.random().toString(),
                        }),
                    )
                    .subscribe();
                stream.subscribe((value: MockEntity) => {
                    expect(value).toEqual(entity);
                    done();
                });
            });
        });

        describe("sync operations", () => {
            it("should set entities if they are not set", (done) => {
                const entity: MockEntity = createEntity();
                const getEntity: () => MockEntity = () => entity;
                const stream: Observable<MockEntity> = store.get(entity.id);
                stream.subscribe((value: MockEntity) => {
                    expect(value).toEqual(entity);
                    done();
                });
                store.getOrSet(entity.id, getEntity);
            });

            it("should not override previously set entities", (done) => {
                const entity: MockEntity = createEntity();
                const getEntity: () => MockEntity = () => entity;
                const stream: Observable<MockEntity> = store.get(entity.id);
                store.getOrSet(entity.id, getEntity);
                store.getOrSet(entity.id, () => ({
                    ...entity,
                    name: Math.random().toString(),
                }));
                stream.subscribe((value: MockEntity) => {
                    expect(value).toEqual(entity);
                    done();
                });
            });
        });

        describe(`cache invalidation`, () => {
            it(`should update the value when the entity is invalidated`, async (done): Promise<void> => {
                let entityName = 0;
                const getEntity: () => MockEntity = () => ({
                    id: "123abc",
                    name: (entityName++).toString(),
                });
                const stream: Observable<MockEntity> = store.getOrSet(
                    "123abc",
                    getEntity,
                );

                let receivedCount = 0;
                stream.subscribe((value: MockEntity) => {
                    receivedCount++;
                    switch (receivedCount) {
                        case 1:
                            expect(value).toEqual({
                                id: "123abc",
                                name: "0",
                            });
                            // invalidate the entity
                            store.delete("123abc");
                            break;
                        case 2:
                            expect(value).toEqual({
                                id: "123abc",
                                name: "1",
                            });
                            // timeout to make sure no further values are received
                            setTimeout(done, 100);
                            break;
                        default:
                            throw new Error(
                                `store should only revalidate once`,
                            );
                    }
                });
            });
        });
    });

    describe("setMany", () => {
        describe("async operations", () => {
            // TODO
        });

        describe("sync operations", () => {
            // TODO
        });
    });

    describe("getAll", () => {
        it("should resolve immediately with the current entities", (done) => {
            const entity: MockEntity = createEntity();
            store.set(entity).subscribe();
            const stream: Observable<MockEntity[]> = store.getAll();
            stream.subscribe((values: MockEntity[]) => {
                expect(values).toEqual([entity]);
                done();
            });
        });

        it("should resolve with an empty array if none are present", (done) => {
            const stream: Observable<MockEntity[]> = store.getAll();
            stream.subscribe((values: MockEntity[]) => {
                expect(values).toEqual([]);
                done();
            });
        });

        it("should update with new values when new values are added", (done) => {
            const entity: MockEntity = createEntity();
            const stream: Observable<MockEntity[]> = store.getAll();
            store.set(entity).subscribe();
            stream.subscribe((values: MockEntity[]) => {
                expect(values).toEqual([entity]);
                done();
            });
        });

        it("should update with new values when entities are deleted", (done) => {
            const entity: MockEntity = createEntity();
            store.set(entity).subscribe();
            const stream: Observable<MockEntity[]> = store.getAll();
            store.delete(entity);
            stream.subscribe((values: MockEntity[]) => {
                expect(values).toEqual([]);
                done();
            });
        });

        it("should update with new values when the store is cleared", (done) => {
            const entity: MockEntity = createEntity();
            store.set(entity).subscribe();
            const stream: Observable<MockEntity[]> = store.getAll();
            store.clear();
            stream.subscribe((values: MockEntity[]) => {
                expect(values).toEqual([]);
                done();
            });
        });
    });

    describe("delete", () => {
        // TODO
    });

    function createEntity(): MockEntity {
        return {
            id: Math.random().toString(),
            name: Math.random().toString(),
        };
    }
});
