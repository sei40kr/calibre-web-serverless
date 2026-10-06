import { setGlobalOptions } from "firebase-functions/v2";

// Every function reads the global options when it is defined, so this module
// must be imported before any of them.
//
// A personal library needs a handful of instances at most. The cap is a cost
// ceiling: without it a burst of requests (an OPDS client looping, a script
// hammering a callable) scales out to the platform default of 100 and bills
// for all of them.
setGlobalOptions({ maxInstances: 10 });
