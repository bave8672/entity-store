import {
    BehaviorSubject,
    combineLatest,
    from,
    isObservable,
    Observable,
    of,
    Subject,
} from "rxjs";
import {
    debounceTime,
    distinctUntilChanged,
    first,
    map,
    startWith,
    switchMap,
    tap,
} from "rxjs/operators";
import {
    DEFAULT_CACHE_TIME,
    DEFAULT_STORE_CONFIG,
    HUMAN_REACTION_TIME,
} from "./constant";
import { isPromise, isYbKey, notUndefined } from "./support";
import { DefaultEntityType, EntityStoreConfig, Id } from "./type";

export class EntityStore<T = DefaultEntityType, TId extends Id = Id> {
    private readonly config: EntityStoreConfig<T, TId>;
    private readonly cache: Map<Id, BehaviorSubject<T | undefined>> = new Map<
        Id,
        BehaviorSubject<T | undefined>
    >();
    private readonly updateStream: Subject<
        BehaviorSubject<T | undefined> | undefined
    > = new Subject<BehaviorSubject<T | undefined> | undefined>();
    private readonly pendingDeletions: Map<
        Id,
        number | NodeJS.Timeout
    > = new Map<string, number | NodeJS.Timeout>();

    public constructor(
        config: Partial<EntityStoreConfig<T, TId>> & T extends DefaultEntityType
            ? Partial<EntityStoreConfig<T, TId>>
            : Pick<EntityStoreConfig<T, TId>, "idAccessor"> = {} as any,
    ) {
        this.config = {
            ...DEFAULT_STORE_CONFIG,
            ...config,
        } as any;
    }

    private getCacheKey(id?: Id): string {
        return `${id}`;
    }

    private getEntitySubjectRef(id: Id): BehaviorSubject<T | undefined> {
        const key: string = this.getCacheKey(id);
        let entitySubject:
            | BehaviorSubject<T | undefined>
            | undefined = this.cache.get(key);
        if (entitySubject === undefined) {
            entitySubject = new BehaviorSubject<T | undefined>(undefined);
            this.cache.set(key, entitySubject);
        }
        return entitySubject;
    }

    private setPendingDeletion(id: Id, cacheTime: number): void {
        clearTimeout(this.pendingDeletions.get(id) as NodeJS.Timeout);
        this.pendingDeletions.set(
            id,
            setTimeout(() => this.deleteSync(id), cacheTime),
        );
    }

    private cancelPendingDeletion(id: Id): void {
        clearTimeout(this.pendingDeletions.get(id) as NodeJS.Timeout);
        this.pendingDeletions.delete(id);
    }

    private setSync(value: T, cacheTime: number): Observable<T> {
        const id: Id = this.config.idAccessor(value);
        const entitySubjectRef = this.getEntitySubjectRef(id);
        const prevValue: T | undefined = entitySubjectRef.getValue();
        const isNew: boolean = prevValue === undefined || prevValue !== value;
        if (isNew) {
            this.setPendingDeletion(id, cacheTime);
            entitySubjectRef.next(value);
            this.updateStream.next(entitySubjectRef);
        }
        return this.get(id);
    }

    private setAsync(stream: Observable<T>, cacheTime: number): Observable<T> {
        return stream.pipe(
            switchMap((value: T) => this.setSync(value, cacheTime)),
        );
    }

    private deleteSync(value: T | Id): void {
        const id: Id = isYbKey(value) ? value : this.config.idAccessor(value);
        this.getEntitySubjectRef(id).next(undefined);
        this.cache.delete(id);
        this.cancelPendingDeletion(id);
        this.updateStream.next();
    }

    private deleteAsync(stream: Observable<T | Id>): Observable<void> {
        return stream.pipe(
            map((value: T | Id) => {
                this.deleteSync(value);
            }),
        );
    }

    private setManySync(values: T[], cacheTime: number): T[] {
        values.forEach((value: T) => {
            this.setSync(value, cacheTime);
        });
        return values;
    }

    private setManyAsync(
        bulkStream: Observable<T[]>,
        cacheTime: number,
    ): Observable<T[]> {
        return bulkStream.pipe(
            tap((values: T[]) => this.setManySync(values, cacheTime)),
        );
    }

    /**
     * Stores an entity
     * @param input an entity or stream of entities to be stored
     * @param cacheTime the cache tinme in milliseconds
     * @returns The stream of entities stored for the given ID
     */
    public set(
        input: T | Promise<T> | Observable<T>,
        cacheTime = DEFAULT_CACHE_TIME,
    ): Observable<T> {
        if (isObservable(input)) {
            return this.setAsync(input, cacheTime);
        } else if (isPromise<T>(input)) {
            return this.setAsync(from(input), cacheTime);
        } else {
            return this.setSync(input, cacheTime);
        }
    }

    /**
     * Get a stream of entities for a given ID
     * @param id The ID of the entity
     * @returns The stream of entities for the given ID
     */
    public get(id: Id): Observable<T> {
        return this.getEntitySubjectRef(id).asObservable().pipe(notUndefined);
    }

    /**
     * Attempts to get an entity corresponding to an ID from the store
     * ANd if it is not found, sets it to the result of the provided function
     * @param id The ID of the entity
     * @param getInput The function that will be called to get the entity if it is not found in the store
     * @param cacheTime The cache time in milliseconds
     * @returns The stream of entities for the given ID
     */
    public getOrSet(
        id: Id,
        getInput: () => T | Promise<T> | Observable<T>,
        cacheTime = DEFAULT_CACHE_TIME,
    ): Observable<T> {
        const entitySubject = this.getEntitySubjectRef(id);
        return (entitySubject.getValue() !== undefined
            ? this.get(id)
            : this.set(getInput(), cacheTime)
        ).pipe(
            first(),
            switchMap(() => entitySubject),
            switchMap((entity: T | undefined) =>
                entity !== undefined
                    ? of(entity)
                    : this.getOrSet(id, getInput, cacheTime).pipe(first()),
            ),
            distinctUntilChanged(),
        );
    }

    /**
     * Deletes a value from the store.
     * @param input can be an entity or an ID, or a stream of either.
     */
    public delete(stream: Observable<T | Id>): Observable<void>;
    public delete(stream: Promise<T | Id>): Observable<void>;
    public delete(value: T | Id): void;
    public delete(
        input: Observable<T | Id> | Promise<T | Id> | T | Id,
    ): Observable<void> | void {
        if (isObservable(input)) {
            return this.deleteAsync(input);
        } else if (isPromise(input)) {
            return this.deleteAsync(from(input));
        } else {
            return this.deleteSync(input);
        }
    }

    /**
     * Clears all values from the store
     */
    public clear(): void {
        for (const subject of this.cache.values()) {
            subject.complete();
            subject.unsubscribe();
        }
        this.cache.clear();
        for (const pendingDeletion of this.pendingDeletions.values()) {
            clearTimeout(pendingDeletion as NodeJS.Timeout);
        }
        this.pendingDeletions.clear();
        this.updateStream.next();
    }

    /**
     * Stores multiple entities.
     * @param input An array or observable array of entities to store
     * @param cacheTime the cache time in milliseconds
     */
    public setMany(input: Observable<T[]>, cacheTime?: number): Observable<T[]>;
    public setMany(input: Promise<T[]>, cacheTime?: number): Observable<T[]>;
    public setMany(input: T[], cacheTime?: number): T[];
    public setMany(
        input: Observable<T[]> | Promise<T[]> | T[],
        cacheTime = DEFAULT_CACHE_TIME,
    ): Observable<T[]> | T[] {
        if (isObservable(input)) {
            return this.setManyAsync(input, cacheTime);
        } else if (isPromise<T[]>(input)) {
            return this.setManyAsync(from(input), cacheTime);
        } else {
            return this.setManySync(input, cacheTime);
        }
    }

    /**
     * Streams all of the entities contained in the store.
     * Emits new values each time any store value is added, updated or deleted.
     * @returns AN observable of all the entities in the store
     */
    public getAll(): Observable<T[]> {
        return this.updateStream.pipe(
            debounceTime(HUMAN_REACTION_TIME),
            startWith(undefined),
            map(() =>
                Array.from(this.cache.keys()).filter(
                    (key: Id) =>
                        this.getEntitySubjectRef(key).getValue() !== undefined,
                ),
            ),
            switchMap((keys: Id[]) =>
                keys.length > 0
                    ? combineLatest(keys.map((key: Id) => this.get(key)))
                    : of([]),
            ),
        );
    }

    /**
     * Disposes of all resources controlled by the store
     */
    public dispose() {
        this.clear();
        this.updateStream.complete();
    }
}
