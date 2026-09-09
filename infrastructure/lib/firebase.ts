import { getApps, initializeApp } from "firebase/app";
import {
	initializeAppCheck,
	ReCaptchaEnterpriseProvider,
} from "firebase/app-check";
import { connectAuthEmulator, getAuth } from "firebase/auth";
import { connectFirestoreEmulator, getFirestore } from "firebase/firestore";
import { connectFunctionsEmulator, getFunctions } from "firebase/functions";
import { connectStorageEmulator, getStorage } from "firebase/storage";

const firebaseConfig = {
	apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
	authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
	projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
	storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
	messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
	appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const app =
	getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);
const functions = getFunctions(app);

// Auth proves which account a request carries; App Check proves the request
// came from this web app. The site key only exists in the deployed
// environments — local development and the E2E run talk to the emulators,
// which have no App Check backend to exchange a reCAPTCHA token with.
const appCheckSiteKey = process.env.NEXT_PUBLIC_FIREBASE_APP_CHECK_SITE_KEY;
if (typeof window !== "undefined" && appCheckSiteKey) {
	initializeAppCheck(app, {
		provider: new ReCaptchaEnterpriseProvider(appCheckSiteKey),
		isTokenAutoRefreshEnabled: true,
	});
}

if (process.env.NODE_ENV === "development" || process.env.NODE_ENV === "test") {
	connectAuthEmulator(auth, "http://localhost:9099");
	connectFirestoreEmulator(db, "localhost", 8080);
	connectStorageEmulator(storage, "localhost", 9199);
	connectFunctionsEmulator(functions, "localhost", 5001);
}

export { app, auth, db, functions, storage };
