import type { Metadata } from "next";
import { Provider as ChakraUIProvider } from "@/components/ui/provider";
import { Toaster } from "@/components/ui/toaster";
import { AuthProvider } from "@/contexts/AuthContext";

export const metadata: Metadata = {
	title: "Calibre-Web",
	description: "Serverless Calibre-Web application",
};

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<html lang="en" suppressHydrationWarning>
			<body>
				<ChakraUIProvider>
					<AuthProvider>{children}</AuthProvider>
					<Toaster />
				</ChakraUIProvider>
			</body>
		</html>
	);
}
