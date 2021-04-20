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
import { HUMAN_REACTION_TIME } from "./EntityStore.constant";
import { isYbKey, notUndefined } from "./EntityStore.support";
import { EntityStoreConfig, YbId } from "./EntityStore.type";

export const YB_DEFAULT_ENTITY_STORE_TIME: number = 600000; // 10 mins

export class EntityStore<T, TId extends YbId = YbId> {
    private readonly cache: Map<YbId, BehaviorSubject<T | undefined>> = new Map<
        YbId,
        BehaviorSubject<T | undefined>
    >();
    private readonly updateStream: Subject<
        BehaviorSubject<T | undefined> | undefined
    > = new Subject<BehaviorSubject<T | undefined> | undefined>();
    private readonly pendingDeletions: Map<
        YbId,
        number | NodeJS.Timeout
    > = new Map<string, number | NodeJS.Timeout>();

    public constructor(private readonly config: EntityStoreConfig<T, TId>) {}

    private getCacheKey(id?: YbId): string {
        return `${id}`;
    }

    private getEntitySubjectRef(id: YbId): BehaviorSubject<T | undefined> {
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

    private setPendingDeletion(id: YbId, cacheTime: number): void {
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
        const id: YbId = this.config.idAccessor(value);
        const entitySubjectRef: BehaviorSubject<
            T | undefined
        > = this.getEntitySubjectRef(id);
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

    private deleteSync(value: T | YbId): void {
        const id: YbId = isYbKey(value) ? value : this.config.idAccessor(value);
        this.getEntitySubjectRef(id).next(undefined);
        this.updateStream.next();
    }

    private deleteAsync(stream: Observable<T | YbId>): Observable<void> {
        return stream.pipe(
            map((value: T | YbId) => {
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

    public set(
        input: T | Observable<T>,
        cacheTime: number = YB_DEFAULT_ENTITY_STORE_TIME,
    ): Observable<T> {
        return isObservable(input)
            ? this.setAsync(input, cacheTime)
            : this.setSync(input, cacheTime);
    }

    public get(id: YbId): Observable<T> {
        return this.getEntitySubjectRef(id).asObservable().pipe(notUndefined);
    }

    public getOrSet(
        id: YbId,
        getInput: () => T | Observable<T>,
        cacheTime: number = YB_DEFAULT_ENTITY_STORE_TIME,
    ): Observable<T> {
        const entitySubject: BehaviorSubject<
            T | undefined
        > = this.getEntitySubjectRef(id);
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

    public delete(stream: Observable<T | YbId>): Observable<void>;
    public delete(value: T | YbId): void;
    public delete(
        input: Observable<T | YbId> | T | YbId,
    ): Observable<void> | void {
        if (isObservable(input)) {
            return this.deleteAsync(input);
        } else {
            this.deleteSync(input);
        }
    }

    public clear(): void {
        this.cache.clear();
        this.updateStream.next();
    }

    public setMany(input: Observable<T[]>, cacheTime?: number): Observable<T[]>;
    public setMany(input: T[], cacheTime?: number): T[];
    public setMany(
        input: Observable<T[]> | T[],
        cacheTime: number = YB_DEFAULT_ENTITY_STORE_TIME,
    ): Observable<T[]> | T[] {
        return isObservable(input)
            ? this.setManyAsync(input, cacheTime)
            : this.setManySync(input, cacheTime);
    }

    public getAll(): Observable<T[]> {
        return this.updateStream.pipe(
            debounceTime(HUMAN_REACTION_TIME),
            startWith(() => undefined),
            map(() =>
                Array.from(this.cache.keys()).filter(
                    (key: YbId) =>
                        this.getEntitySubjectRef(key).getValue() !== undefined,
                ),
            ),
            switchMap((keys: YbId[]) =>
                keys.length > 0
                    ? combineLatest(keys.map((key: YbId) => this.get(key)))
                    : of([]),
            ),
        );
    }
}
