import {
    BehaviorSubject,
    combineLatest,
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
import { DEFAULT_ENTITY_STORE_TIME, HUMAN_REACTION_TIME } from "./constant";
import { isYbKey, notUndefined } from "./support";
import { EntityStoreConfig, Id } from "./type";

export class EntityStore<T, TId extends Id = Id> {
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

    public constructor(private readonly config: EntityStoreConfig<T, TId>) {}

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
            setTimeout(() => {
                const subjectRef: BehaviorSubject<
                    T | undefined
                > = this.getEntitySubjectRef(id);
                if (subjectRef.observers.length > 0) {
                    this.setPendingDeletion(id, cacheTime);
                    return;
                } else {
                    this.cache.delete(id);
                    this.pendingDeletions.delete(id);
                }
            }, cacheTime),
        );
    }

    private setSync(value: T, cacheTime: number): Observable<T> {
        const id: Id = this.config.idAccessor(value);
        const entitySubjectRef = this.getEntitySubjectRef(id);
        const prevValue: T | undefined = entitySubjectRef.getValue();
        const isNew: boolean = prevValue === undefined || prevValue !== value;
        entitySubjectRef.next(value);
        if (isNew) {
            this.updateStream.next(entitySubjectRef);
        }
        this.setPendingDeletion(id, cacheTime);
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
        input: T | Observable<T>,
        cacheTime = DEFAULT_ENTITY_STORE_TIME,
    ): Observable<T> {
        return isObservable(input)
            ? this.setAsync(input, cacheTime)
            : this.setSync(input, cacheTime);
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
        getInput: () => T | Observable<T>,
        cacheTime = DEFAULT_ENTITY_STORE_TIME,
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
                    : this.getOrSet(id, getInput, cacheTime),
            ),
            distinctUntilChanged(),
        );
    }

    /**
     * Deletes a value from the store.
     * @param input can be an entity or an ID, or a stream of either.
     */
    public delete(stream: Observable<T | Id>): Observable<void>;
    public delete(value: T | Id): void;
    public delete(input: Observable<T | Id> | T | Id): Observable<void> | void {
        if (isObservable(input)) {
            return this.deleteAsync(input);
        } else {
            this.deleteSync(input);
        }
    }

    /**
     * Clears all values from the store
     */
    public clear(): void {
        this.cache.clear();
        this.updateStream.next();
    }

    /**
     * Stores multiple entities.
     * @param input An array or observable array of entities to store
     * @param cacheTime the cache time in milliseconds
     */
    public setMany(input: Observable<T[]>, cacheTime?: number): Observable<T[]>;
    public setMany(input: T[], cacheTime?: number): T[];
    public setMany(
        input: Observable<T[]> | T[],
        cacheTime = DEFAULT_ENTITY_STORE_TIME,
    ): Observable<T[]> | T[] {
        return isObservable(input)
            ? this.setManyAsync(input, cacheTime)
            : this.setManySync(input, cacheTime);
    }

    /**
     * Streams all of the entities contained in the store.
     * Emits new values each time any store value is added, updated or deleted.
     * @returns AN observable of all the entities in the store
     */
    public getAll(): Observable<T[]> {
        return this.updateStream.pipe(
            debounceTime(HUMAN_REACTION_TIME),
            startWith(() => undefined),
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
}
