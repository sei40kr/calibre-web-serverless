const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
	["day", 86_400_000],
	["hour", 3_600_000],
	["minute", 60_000],
];

/** "5 minutes ago", "yesterday": how long ago `date` was. */
export const formatAgo = (date: Date) => {
	const elapsed = Date.now() - date.getTime();
	const [unit, ms] = UNITS.find(([, ms]) => elapsed >= ms) ?? UNITS[2];
	return new Intl.RelativeTimeFormat(undefined, { numeric: "auto" }).format(
		-Math.floor(elapsed / ms),
		unit,
	);
};
