import { Observable } from "rxjs";
import { filter } from "rxjs/operators";
import { Id } from "./type";

export const isDefined = <T>(value: T | undefined): value is T => !!value;

export const notUndefined: <T>(
    stream: Observable<T | undefined>,
) => Observable<T> = filter(isDefined);

export function isYbKey(value: unknown): value is Id {
    return typeof value === "string" || typeof value === "number";
}
