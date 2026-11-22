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

/** Time on one page beyond this is taken as the reader having stepped away. */
export const MAX_SECONDS_PER_PAGE = 5 * 60;

/** Pace measured over less reading than this is too noisy to estimate from. */
export const MIN_ESTIMATE_SECONDS = 60;

const sum = (values: number[]) => values.reduce((total, v) => total + v, 0);

/** Units (EPUB: characters, pages) before the screen at `location`. */
function unitsBefore(location: ReadingLocation): number {
	if ("pageNo" in location) return location.pageNo - 1;
	return (
		sum(location.chapterLengths.slice(0, location.chapterNo - 1)) +
		location.charOffset
	);
}

function totalUnits(location: ReadingLocation): number {
	return "pageNo" in location
		? location.pageCount
		: sum(location.chapterLengths);
}

/**
 * Whether `to` is the page right after `from`: the only move whose time
 * measures reading, as jumps and turning back read nothing. A comic spread
 * advances two pages.
 */
function isNextPage(from: ReadingLocation, to: ReadingLocation): boolean {
	if ("pageNo" in from && "pageNo" in to) {
		const step = to.pageNo - from.pageNo;
		return step > 0 && step <= 2;
	}
	if ("chapterNo" in from && "chapterNo" in to) {
		return to.chapterNo === from.chapterNo
			? to.charOffset > from.charOffset
			: to.chapterNo === from.chapterNo + 1 && to.charOffset === 0;
	}
	return false;
}

/**
 * Moves the book to `location` in `format`. When that is the page after the
 * saved one, the `secondsOnPrevious` spent there (capped at
 * {@link MAX_SECONDS_PER_PAGE}) and the units it held are added to the pace.
 * Opening an unread book starts it; a read one stays read.
 */
export function withLocation(
	reading: ReadingProgress,
	format: PositionedFormat,
	location: ReadingLocation,
	at: Date,
	secondsOnPrevious = 0,
): InProgress | ReadProgress {
	const positions = readingPositions(reading);
	const previous = positions[format];
	const read = previous !== undefined && isNextPage(previous, location);
	const position = {
		activeSeconds:
			(previous?.activeSeconds ?? 0) +
			(read ? Math.min(secondsOnPrevious, MAX_SECONDS_PER_PAGE) : 0),
		unitsRead:
			(previous?.unitsRead ?? 0) +
			(read ? unitsBefore(location) - unitsBefore(previous) : 0),
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
 * Seconds left to the end of the book at the reader's pace in this format,
 * or null until enough reading has been measured.
 */
export function secondsLeft(
	position: EpubPosition | PagePosition,
): number | null {
	if (
		position.activeSeconds < MIN_ESTIMATE_SECONDS ||
		position.unitsRead <= 0
	) {
		return null;
	}
	const remaining = Math.max(totalUnits(position) - unitsBefore(position), 0);
	return (remaining * position.activeSeconds) / position.unitsRead;
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
	const total = totalUnits(location);
	return total > 0 ? Math.min(unitsBefore(location) / total, 1) : 0;
}

/**
 * How much of the book is read, in [0, 1], or null when it has not been
 * started. A read book is wholly read wherever it was left.
 */
export function readingFraction(reading: ReadingProgress): number | null {
	if (reading.status === "read") return 1;
	const position = currentPosition(reading);
	return position ? locationFraction(position) : null;
}
