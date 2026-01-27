/**
 * Abstract base class for identifier types.
 * Each identifier type is a singleton with its own validation logic.
 */
export abstract class IdentifierType {
	private static readonly registry: IdentifierType[] = [];

	abstract readonly name: string;
	abstract readonly value: string;

	/**
	 * Validate the identifier value.
	 * @returns true if valid, or an error message string if invalid.
	 */
	abstract validate(value: string): string | true;

	protected constructor() {
		IdentifierType.registry.push(this);
	}

	/**
	 * Get all registered identifier types.
	 */
	static all(): IdentifierType[] {
		return [...IdentifierType.registry];
	}

	/**
	 * Find an identifier type by its string representation.
	 */
	static from(value: string): IdentifierType | undefined {
		return IdentifierType.registry.find((t) => t.value === value);
	}
}

/**
 * ISBN-10 identifier type.
 * Format: 10 characters (digits, last can be X)
 */
class ISBNType extends IdentifierType {
	static readonly INSTANCE = new ISBNType();
	readonly name = "ISBN";
	readonly value = "isbn";

	private constructor() {
		super();
	}

	validate(value: string): string | true {
		if (!value.trim()) {
			return "Value is required";
		}

		const cleaned = value.replace(/[-\s]/g, "");
		if (!/^[\dX]{10}$/i.test(cleaned)) {
			return "ISBN must be 10 characters (digits or X)";
		}

		// Validate checksum
		let sum = 0;
		for (let i = 0; i < 9; i++) {
			sum += Number.parseInt(cleaned[i], 10) * (10 - i);
		}
		const lastChar = cleaned[9].toUpperCase();
		const checkDigit = lastChar === "X" ? 10 : Number.parseInt(lastChar, 10);
		sum += checkDigit;

		if (sum % 11 !== 0) {
			return "Invalid ISBN checksum";
		}

		return true;
	}
}

/**
 * ISBN-13 identifier type.
 * Format: 13 digits
 */
class ISBN13Type extends IdentifierType {
	static readonly INSTANCE = new ISBN13Type();
	readonly name = "ISBN13";
	readonly value = "isbn13";

	private constructor() {
		super();
	}

	validate(value: string): string | true {
		if (!value.trim()) {
			return "Value is required";
		}

		const cleaned = value.replace(/[-\s]/g, "");
		if (!/^\d{13}$/.test(cleaned)) {
			return "ISBN-13 must be 13 digits";
		}

		// Validate checksum
		let sum = 0;
		for (let i = 0; i < 12; i++) {
			sum += Number.parseInt(cleaned[i], 10) * (i % 2 === 0 ? 1 : 3);
		}
		const checkDigit = (10 - (sum % 10)) % 10;

		if (checkDigit !== Number.parseInt(cleaned[12], 10)) {
			return "Invalid ISBN-13 checksum";
		}

		return true;
	}
}

/**
 * Amazon ASIN identifier type.
 * Format: 10 alphanumeric characters
 */
class AmazonType extends IdentifierType {
	static readonly INSTANCE = new AmazonType();
	readonly name = "AMAZON";
	readonly value = "amazon";

	private constructor() {
		super();
	}

	validate(value: string): string | true {
		if (!value.trim()) {
			return "Value is required";
		}

		if (!/^[A-Z0-9]{10}$/i.test(value)) {
			return "ASIN must be 10 alphanumeric characters";
		}

		return true;
	}
}

/**
 * Google Books ID identifier type.
 * Format: 12 alphanumeric characters with possible underscores/hyphens
 */
class GoogleType extends IdentifierType {
	static readonly INSTANCE = new GoogleType();
	readonly name = "GOOGLE";
	readonly value = "google";

	private constructor() {
		super();
	}

	validate(value: string): string | true {
		if (!value.trim()) {
			return "Value is required";
		}

		if (!/^[\w-]{12}$/.test(value)) {
			return "Google Books ID must be 12 characters";
		}

		return true;
	}
}

/**
 * Goodreads ID identifier type.
 * Format: Numeric ID
 */
class GoodreadsType extends IdentifierType {
	static readonly INSTANCE = new GoodreadsType();
	readonly name = "GOODREADS";
	readonly value = "goodreads";

	private constructor() {
		super();
	}

	validate(value: string): string | true {
		if (!value.trim()) {
			return "Value is required";
		}

		if (!/^\d+$/.test(value)) {
			return "Goodreads ID must be numeric";
		}

		return true;
	}
}

// Export singleton instances
export const ISBN = ISBNType.INSTANCE;
export const ISBN13 = ISBN13Type.INSTANCE;
export const AMAZON = AmazonType.INSTANCE;
export const GOOGLE = GoogleType.INSTANCE;
export const GOODREADS = GoodreadsType.INSTANCE;

/**
 * Identifier with type and value.
 */
export interface Identifier {
	type: IdentifierType;
	value: string;
}
