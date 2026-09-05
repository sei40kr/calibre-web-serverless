import type { Metadata } from "next";
import { UploadProgressOverlay } from "@/components/UploadProgressOverlay";
import { Provider as ChakraUIProvider } from "@/components/ui/provider";
import { Toaster } from "@/components/ui/toaster";
import { AuthProvider } from "@/contexts/AuthContext";
import { BookUploadProvider } from "@/contexts/BookUploadContext";

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
					<AuthProvider>
						<BookUploadProvider>
							{children}
							<UploadProgressOverlay />
						</BookUploadProvider>
					</AuthProvider>
					<Toaster />
				</ChakraUIProvider>
			</body>
		</html>
	);
}
