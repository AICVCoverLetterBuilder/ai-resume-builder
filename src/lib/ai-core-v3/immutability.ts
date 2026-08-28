type JsonLikeObject = Record<PropertyKey, unknown>;

function cloneAndFreeze<T>(value: T, seen: WeakMap<object, object>): T {
  if (value === null || typeof value !== 'object') {
    return value;
  }

  const existing = seen.get(value);
  if (existing) {
    return existing as T;
  }

  if (Array.isArray(value)) {
    const copy: unknown[] = [];
    seen.set(value, copy);
    for (const item of value) {
      copy.push(cloneAndFreeze(item, seen));
    }
    return Object.freeze(copy) as T;
  }

  const source = value as JsonLikeObject;
  const copy: JsonLikeObject = {};
  seen.set(value, copy);
  for (const key of Reflect.ownKeys(source)) {
    copy[key] = cloneAndFreeze(source[key], seen);
  }
  return Object.freeze(copy) as T;
}

export function immutableCopy<T>(value: T): Readonly<T> {
  return cloneAndFreeze(value, new WeakMap<object, object>()) as Readonly<T>;
}
