/**
 * Focused reading time and how much was read during it, in the position's own
 * unit (EPUB: characters, PDF/CBZ: pages). Their ratio is the reader's pace in
 * this book and format.
 */
export interface ReadingPace {
	activeSeconds: number;
	unitsRead: number;
}

export interface EpubPosition extends ReadingPace {
	/** 1-based spine chapter. */
	chapterNo: number;
	/**
	 * Characters in the chapter before the first one on screen. Unlike a page
	 * number it survives viewport and font size changes.
	 */
	charOffset: number;
	/** TOC title of the chapter, kept so it is known without opening the book. */
	chapterTitle: string | null;
	/** Character count of every spine chapter, in spine order. */
	chapterLengths: number[];
}

export interface PagePosition extends ReadingPace {
	/** 1-based page. */
	pageNo: number;
	pageCount: number;
}

/** The last position in each format, since their units cannot be shared. */
export interface ReadingPositions {
	epub?: EpubPosition;
	pdf?: PagePosition;
	cbz?: PagePosition;
}

export type PositionedFormat = keyof ReadingPositions;

/** Positions that include one in the format read last, the book's current one. */
export type LastReadIn = {
	[F in PositionedFormat]: {
		lastFormat: F;
		positions: ReadingPositions & Required<Pick<ReadingPositions, F>>;
	};
}[PositionedFormat];

/**
 * A book marked read without ever being opened, so no position is known: an
 * unread book can be marked read as is, as when it was read outside the app.
 */
interface NeverOpened {
	lastFormat: null;
	positions: { [F in PositionedFormat]?: never };
}

// The other fields are spelled out as absent: only object literals get the
// excess property check, so without them any value with `status: "unread"`
// would pass, positions and all.
export type UnreadProgress = {
	status: "unread";
	lastReadAt?: never;
	lastFormat?: never;
	positions?: never;
};
export type InProgress = { status: "reading"; lastReadAt: Date } & LastReadIn;
export type ReadProgress = { status: "read"; lastReadAt: Date } & (
	| LastReadIn
	| NeverOpened
);
export type ReadingProgress = UnreadProgress | InProgress | ReadProgress;
export type ReadingStatus = ReadingProgress["status"];

export const unreadProgress: UnreadProgress = { status: "unread" };

/**
 * Pairs `positions` with `format` as the format read last, or null when they
 * hold no position in it.
 */
export function lastReadIn(
	format: PositionedFormat,
	positions: ReadingPositions,
): LastReadIn | null {
	// TypeScript cannot tie a key's type to the value checked at it.
	return positions[format]
		? ({ lastFormat: format, positions } as LastReadIn)
		: null;
}

/** The position each format was left at; none for an unread book. */
export function readingPositions(reading: ReadingProgress): ReadingPositions {
	return reading.status === "unread" ? {} : reading.positions;
}

/** Where the book currently is: its position in the format read last. */
export function currentPosition(
	reading: ReadingProgress,
): EpubPosition | PagePosition | null {
	if (reading.status === "unread" || reading.lastFormat === null) return null;
	return reading.positions[reading.lastFormat] ?? null;
}

/** A position without the pace measured at it. */
export type EpubLocation = Omit<EpubPosition, keyof ReadingPace>;
export type PageLocation = Omit<PagePosition, keyof ReadingPace>;
export type ReadingLocation = EpubLocation | PageLocation;

/**
 * Moves the book to `location` in `format`, keeping the pace measured there.
 * Opening an unread book starts it; a read one stays read.
 */
export function withLocation(
	reading: ReadingProgress,
	format: PositionedFormat,
	location: ReadingLocation,
	at: Date,
): InProgress | ReadProgress {
	const positions = readingPositions(reading);
	const previous = positions[format];
	const position = {
		activeSeconds: previous?.activeSeconds ?? 0,
		unitsRead: previous?.unitsRead ?? 0,
		...location,
	};
	// Never null: the position in `format` was just set.
	const current = lastReadIn(format, {
		...positions,
		[format]: position,
	}) as LastReadIn;
	return reading.status === "read"
		? { status: "read", lastReadAt: at, ...current }
		: { status: "reading", lastReadAt: at, ...current };
}

/**
 * How far through the book a location is, in [0, 1]. EPUB counts the
 * characters before the screen; pages count the current one as read, so the
 * last page is 1.
 */
export function locationFraction(location: ReadingLocation): number {
	if ("pageNo" in location) {
		return location.pageCount > 0
			? Math.min(location.pageNo / location.pageCount, 1)
			: 0;
	}
	const { chapterLengths, chapterNo, charOffset } = location;
	const total = chapterLengths.reduce((sum, length) => sum + length, 0);
	if (total === 0) return 0;
	const before = chapterLengths
		.slice(0, chapterNo - 1)
		.reduce((sum, length) => sum + length, 0);
	return Math.min((before + charOffset) / total, 1);
}
