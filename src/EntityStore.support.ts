import { Observable } from "rxjs";
import { filter } from "rxjs/operators";
import { YbId } from "./EntityStore.type";

export const notUndefined: <T>(
    stream: Observable<T | undefined>,
) => Observable<T> = filter<any>(
    (value: any | undefined) => value !== undefined,
);

export function isYbKey(value: any): value is YbId {
    return typeof value === "string" || typeof value === "number";
}
