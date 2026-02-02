/**
 * Language model using ISO 639-1 codes.
 * Each language is a singleton instance.
 */
export class Language {
	private static readonly registry: Language[] = [];

	readonly code: string;
	readonly name: string;

	private constructor(code: string, name: string) {
		this.code = code;
		this.name = name;
		Language.registry.push(this);
	}

	static all(): Language[] {
		return [...Language.registry];
	}

	static from(code: string): Language | undefined {
		return Language.registry.find((l) => l.code === code);
	}

	static readonly EN = new Language("en", "English");
	static readonly DE = new Language("de", "German");
	static readonly FR = new Language("fr", "French");
	static readonly ES = new Language("es", "Spanish");
	static readonly IT = new Language("it", "Italian");
	static readonly PT = new Language("pt", "Portuguese");
	static readonly JA = new Language("ja", "Japanese");
	static readonly ZH = new Language("zh", "Chinese");
	static readonly KO = new Language("ko", "Korean");
	static readonly RU = new Language("ru", "Russian");
	static readonly AR = new Language("ar", "Arabic");
	static readonly NL = new Language("nl", "Dutch");
	static readonly SV = new Language("sv", "Swedish");
	static readonly PL = new Language("pl", "Polish");
	static readonly LA = new Language("la", "Latin");
}
