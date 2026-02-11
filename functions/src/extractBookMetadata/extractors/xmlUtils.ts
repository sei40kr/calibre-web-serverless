export function toArray<T>(value: T | T[] | undefined): T[] {
	if (value === undefined) return [];
	return Array.isArray(value) ? value : [value];
}

export function textOf(value: unknown): string | null {
	if (value === undefined || value === null) return null;
	if (typeof value === "string") return value.trim() || null;
	if (typeof value === "number") return String(value);
	if (
		typeof value === "object" &&
		"#text" in (value as Record<string, unknown>)
	) {
		return textOf((value as Record<string, unknown>)["#text"]);
	}
	return null;
}
