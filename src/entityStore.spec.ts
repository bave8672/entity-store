import { isObservable, Observable, of } from "rxjs";
import { DEFAULT_CACHE_TIME } from "./constant";
import { EntityStore, EntityStoreConfig } from "./index";

describe("Entity Store", () => {
    interface MockEntity {
        id: string;
        name: string;
    }

    const MOCK_ENTITY_CONFIG: EntityStoreConfig<MockEntity> = {
        defaultCacheTIme: DEFAULT_CACHE_TIME,
        idAccessor: (entity: MockEntity): string => entity.id,
    };

    describe(`Constructor`, () => {
        interface Simple {
            id: string;
        }

        interface Complex {
            complexId: string;
        }

        it(`Should not require config for the default entity type`, () => {
            new EntityStore<Simple>({});
        });

        it(`Should require an id accessor when the entity id field does not match "id"`, () => {
            new EntityStore<Complex>({ idAccessor: (e) => e.complexId });
            new EntityStore<Complex>();
        });
    });

    describe("basic get/set", () => {
        describe("async operations", () => {
            it("should return an unresolved observable for values that have not been set", () => {
                const store = new EntityStore<MockEntity>(MOCK_ENTITY_CONFIG);
                const stream: Observable<MockEntity> = store.get("asxasx");
                stream.subscribe((value: MockEntity) => {
                    throw new Error(`Unexpected value: ${value}`);
                });
                expect(isObservable(stream)).toBe(true);
                store.dispose();
            });

            it("should resolve a stream with new values as they are set", (done) => {
                const store = new EntityStore(MOCK_ENTITY_CONFIG);
                const entity: MockEntity = createEntity();
                const stream: Observable<MockEntity> = store.get(entity.id);
                stream.subscribe((value: MockEntity) => {
                    expect(value).toEqual(entity);
                    store.dispose();
                    done();
                });
                store.set(of(entity)).subscribe();
            });

            it("should resolve a stream with new values as they are set from a promise", (done) => {
                const store = new EntityStore(MOCK_ENTITY_CONFIG);
                const entity: MockEntity = createEntity();
                const stream: Observable<MockEntity> = store.get(entity.id);
                stream.subscribe((value: MockEntity) => {
                    expect(value).toEqual(entity);
                    store.dispose();
                    done();
                });
                store.set(Promise.resolve(entity)).subscribe();
            });

            it("should resolve previously set values", (done) => {
                const store = new EntityStore(MOCK_ENTITY_CONFIG);
                const entity: MockEntity = createEntity();
                store.set(of(entity)).subscribe();
                store.get(entity.id).subscribe((value: MockEntity) => {
                    expect(value).toEqual(entity);
                    store.dispose();
                    done();
                });
            });

            it("should resolve set values immediately", (done) => {
                const store = new EntityStore(MOCK_ENTITY_CONFIG);
                const entity: MockEntity = createEntity();
                store.set(of(entity)).subscribe((value: MockEntity) => {
                    expect(value).toEqual(entity);
                    store.dispose();
                    done();
                });
            });
        });

        describe("sync operations", () => {
            it("should resolve a stream with new values as they are set", (done) => {
                const store = new EntityStore(MOCK_ENTITY_CONFIG);
                const entity: MockEntity = createEntity();
                const stream: Observable<MockEntity> = store.get(entity.id);
                stream.subscribe((value: MockEntity) => {
                    expect(value).toEqual(entity);
                    store.dispose();
                    done();
                });
                store.set(entity);
            });

            it("should resolve previously set values", (done) => {
                const store = new EntityStore(MOCK_ENTITY_CONFIG);
                const entity: MockEntity = createEntity();
                store.set(entity);
                store.get(entity.id).subscribe((value: MockEntity) => {
                    expect(value).toEqual(entity);
                    store.dispose();
                    done();
                });
            });

            it("should resolve set values immediately", (done) => {
                const store = new EntityStore(MOCK_ENTITY_CONFIG);
                const entity: MockEntity = createEntity();
                store.set(entity).subscribe((value: MockEntity) => {
                    expect(value).toEqual(entity);
                    store.dispose();
                    done();
                });
            });
        });
    });

    describe("getOrSet", () => {
        describe("async operations", () => {
            it("should set entities if they are not set", (done) => {
                const store = new EntityStore(MOCK_ENTITY_CONFIG);
                const entity: MockEntity = createEntity();
                const getEntity: () => Observable<MockEntity> = () =>
                    of(entity);
                const stream: Observable<MockEntity> = store.get(entity.id);
                stream.subscribe((value: MockEntity) => {
                    expect(value).toEqual(entity);
                    store.dispose();
                    done();
                });
                store.getOrSet(entity.id, getEntity).subscribe();
            });

            it("should not override previously set entities", (done) => {
                const store = new EntityStore(MOCK_ENTITY_CONFIG);
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
                    store.dispose();
                    done();
                });
            });
        });

        describe("sync operations", () => {
            it("should set entities if they are not set", (done) => {
                const store = new EntityStore(MOCK_ENTITY_CONFIG);
                const entity: MockEntity = createEntity();
                const getEntity: () => MockEntity = () => entity;
                const stream: Observable<MockEntity> = store.get(entity.id);
                stream.subscribe((value: MockEntity) => {
                    expect(value).toEqual(entity);
                    store.dispose();
                    done();
                });
                store.getOrSet(entity.id, getEntity);
            });

            it("should not override previously set entities", (done) => {
                const store = new EntityStore(MOCK_ENTITY_CONFIG);
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
                    store.dispose();
                    done();
                });
            });
        });

        describe(`cache invalidation`, () => {
            it(`should update the value when the entity is deleted`, (done) => {
                const store = new EntityStore(MOCK_ENTITY_CONFIG);
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
                            setTimeout(() => {
                                store.dispose();
                                done();
                            }, 100);
                            break;
                        default:
                            throw new Error(
                                `store should only revalidate once`,
                            );
                    }
                });
            });

            it(`should update the value when the entity is renewed`, (done) => {
                const store = new EntityStore(MOCK_ENTITY_CONFIG);
                const entityA = createEntity();
                entityA.id = "123abc";
                const entityB = createEntity();
                entityB.id = "123abc";
                const stream: Observable<MockEntity> = store.get("123abc");
                store.set(entityA);
                let receivedCount = 0;
                stream.subscribe((value: MockEntity) => {
                    receivedCount++;
                    switch (receivedCount) {
                        case 1:
                            expect(value).toEqual(entityA);
                            // invalidate the entity
                            store.set(of(entityB)).subscribe();
                            break;
                        case 2:
                            expect(value).toEqual(entityB);
                            // timeout to make sure no further values are received
                            setTimeout(() => {
                                store.dispose();
                                done();
                            }, 100);
                            break;
                        default:
                            throw new Error(
                                `store should only revalidate once`,
                            );
                    }
                });
            });

            it(`should expire the cache after the given cache period`, (done) => {
                const store = new EntityStore(MOCK_ENTITY_CONFIG);
                const entity = createEntity();
                const cacheTime = 100;
                store.set(entity, cacheTime).subscribe();
                // verify the4 object is in the cache
                store.get(entity.id).subscribe((value) => {
                    expect(value).toEqual(entity);
                });
                // verify the object has been evicted
                setTimeout(() => {
                    store.get(entity.id).subscribe((value) => {
                        throw new Error(`Unexpected value: ${value}`);
                    });
                    setTimeout(() => {
                        done();
                    }, 100);
                }, cacheTime + 100);
            });

            it(`should not update the value when setting an identical entity`, (done) => {
                const store = new EntityStore(MOCK_ENTITY_CONFIG);
                const entity = createEntity();
                let receivedCount = 0;
                store.get(entity.id).subscribe((value) => {
                    receivedCount++;
                    expect(value).toEqual(entity);
                    if (receivedCount > 1) {
                        throw new Error(
                            `Received identical value more than once`,
                        );
                    }
                });
                store.set(of(entity));
                store.set(entity);
                store.setMany([entity, entity]);
                // assert not thrown after timeout
                setTimeout(() => {
                    store.dispose();
                    done();
                });
            });
        });
    });

    describe("setMany", () => {
        describe("async operations", () => {
            it(`Should set many from an observable`, (done) => {
                const store = new EntityStore(MOCK_ENTITY_CONFIG);
                const entityA = createEntity();
                const entityB = createEntity();
                store.setMany(of([entityA, entityB]), 1000).subscribe();
                store.get(entityA.id).subscribe((value) => {
                    expect(value).toEqual(entityA);
                });
                store.get(entityB.id).subscribe((value) => {
                    expect(value).toEqual(entityB);
                });
                setTimeout(() => {
                    store.dispose();
                    done();
                }, 100);
            });

            it(`Should set many from a promise`, (done) => {
                const store = new EntityStore(MOCK_ENTITY_CONFIG);
                const entityA = createEntity();
                const entityB = createEntity();
                store
                    .setMany(Promise.resolve([entityA, entityB]), 1000)
                    .subscribe();
                store.get(entityA.id).subscribe((value) => {
                    expect(value).toEqual(entityA);
                });
                store.get(entityB.id).subscribe((value) => {
                    expect(value).toEqual(entityB);
                });
                setTimeout(() => {
                    store.dispose();
                    done();
                }, 100);
            });
        });

        describe("sync operations", () => {
            it(`Should set many from an array`, (done) => {
                const store = new EntityStore(MOCK_ENTITY_CONFIG);
                const entityA = createEntity();
                const entityB = createEntity();
                store.setMany([entityA, entityB]);
                store.get(entityA.id).subscribe((value) => {
                    expect(value).toEqual(entityA);
                });
                store.get(entityB.id).subscribe((value) => {
                    expect(value).toEqual(entityB);
                });
                setTimeout(() => {
                    store.dispose();
                    done();
                }, 100);
            });
        });
    });

    describe("getAll", () => {
        it("should resolve immediately with the current entities", (done) => {
            const store = new EntityStore(MOCK_ENTITY_CONFIG);
            const entity: MockEntity = createEntity();
            store.set(entity).subscribe();
            const stream: Observable<MockEntity[]> = store.getAll();
            stream.subscribe((values: MockEntity[]) => {
                expect(values).toEqual([entity]);
                store.dispose();
                done();
            });
        });

        it("should resolve with an empty array if none are present", (done) => {
            const store = new EntityStore(MOCK_ENTITY_CONFIG);
            const stream: Observable<MockEntity[]> = store.getAll();
            stream.subscribe((values: MockEntity[]) => {
                expect(values).toEqual([]);
                store.dispose();
                done();
            });
        });

        it("should update with new values when new values are added", (done) => {
            const store = new EntityStore(MOCK_ENTITY_CONFIG);
            const entity: MockEntity = createEntity();
            const stream: Observable<MockEntity[]> = store.getAll();
            store.set(entity).subscribe();
            stream.subscribe((values: MockEntity[]) => {
                expect(values).toEqual([entity]);
                store.dispose();
                done();
            });
        });

        it("should update with new values when entities are deleted", (done) => {
            const store = new EntityStore(MOCK_ENTITY_CONFIG);
            const entity: MockEntity = createEntity();
            store.set(entity).subscribe();
            const stream: Observable<MockEntity[]> = store.getAll();
            store.delete(entity);
            stream.subscribe((values: MockEntity[]) => {
                expect(values).toEqual([]);
                store.dispose();
                done();
            });
        });

        it("should update with new values when the store is cleared", (done) => {
            const store = new EntityStore(MOCK_ENTITY_CONFIG);
            const entity: MockEntity = createEntity();
            store.set(entity).subscribe();
            const stream: Observable<MockEntity[]> = store.getAll();
            store.dispose();
            stream.subscribe((values: MockEntity[]) => {
                expect(values).toEqual([]);
                store.dispose();
                done();
            });
        });
    });

    describe("delete", () => {
        describe("async operations", () => {
            it(`Should delete a key from the store via an observable`, (done) => {
                const store = new EntityStore(MOCK_ENTITY_CONFIG);
                const entity: MockEntity = createEntity();
                store.set(entity);
                const stream: Observable<MockEntity[]> = store.getAll();
                store.delete(of(entity)).subscribe();
                stream.subscribe((values: MockEntity[]) => {
                    expect(values).toEqual([]);
                    store.dispose();
                    done();
                });
            });

            it(`Should delete a key from the store via a promise`, (done) => {
                const store = new EntityStore(MOCK_ENTITY_CONFIG);
                const entity: MockEntity = createEntity();
                store.set(entity);
                const stream: Observable<MockEntity[]> = store.getAll();
                store.delete(Promise.resolve(entity)).subscribe(() => {
                    stream.subscribe((values: MockEntity[]) => {
                        expect(values).toEqual([]);
                        store.dispose();
                        done();
                    });
                });
            });
        });

        describe("sync operations", () => {
            it(`Should delete a key from the store`, (done) => {
                const store = new EntityStore(MOCK_ENTITY_CONFIG);
                const entity: MockEntity = createEntity();
                store.set(entity);
                const stream: Observable<MockEntity[]> = store.getAll();
                store.delete(entity.id);
                stream.subscribe((values: MockEntity[]) => {
                    expect(values).toEqual([]);
                    store.dispose();
                    done();
                });
            });
        });
    });

    function createEntity(): MockEntity {
        return {
            id: Math.random().toString(),
            name: Math.random().toString(),
        };
    }
});
