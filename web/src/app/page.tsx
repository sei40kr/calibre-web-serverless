"use client";

import { AuthError } from "@calibre-web-serverless/domain/errors/authError";
import { authService } from "@calibre-web-serverless/infrastructure/services/authService";
import {
	Box,
	Button,
	Container,
	Fieldset,
	Flex,
	Heading,
	Input,
	Stack,
	Text,
} from "@chakra-ui/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { Alert } from "@/components/ui/alert";
import { Field } from "@/components/ui/field";
import { useAuth } from "@/contexts/AuthContext";

interface LoginFormData {
	email: string;
	password: string;
}

export default function Home() {
	const router = useRouter();
	const { user, loading } = useAuth();
	const [authError, setAuthError] = useState<string | null>(null);
	const [isTestLoggingIn, setIsTestLoggingIn] = useState(false);
	const {
		register,
		handleSubmit,
		formState: { errors, isSubmitting },
	} = useForm<LoginFormData>();

	const isDev = process.env.NODE_ENV === "development";

	useEffect(() => {
		if (!loading && user) {
			router.replace("/dashboard");
		}
	}, [user, loading, router]);

	const handleTestLogin = async () => {
		setAuthError(null);
		setIsTestLoggingIn(true);
		try {
			await authService.signIn("test@example.com", "password123");
			router.replace("/dashboard");
		} catch (error) {
			if (error instanceof AuthError) {
				setAuthError("Failed to sign in as test user");
			} else {
				setAuthError("An unexpected error occurred");
			}
		} finally {
			setIsTestLoggingIn(false);
		}
	};

	const onSubmit = async (data: LoginFormData) => {
		setAuthError(null);
		try {
			await authService.signIn(data.email, data.password);
			router.replace("/dashboard");
		} catch (error) {
			if (error instanceof AuthError) {
				switch (error.code) {
					case "invalid-credential":
						setAuthError("Invalid email or password");
						break;
					case "too-many-requests":
						setAuthError("Too many attempts. Please try again later");
						break;
					case "user-disabled":
						setAuthError("This account has been disabled");
						break;
					default:
						setAuthError("Failed to sign in");
				}
			} else {
				setAuthError("An unexpected error occurred");
			}
		}
	};

	return (
		<Flex minH="100vh" align="center" justify="center" bg="gray.50">
			<Container maxW="md">
				<Box p={8} borderWidth={1} borderRadius="lg" boxShadow="lg" bg="white">
					<Stack gap={6}>
						<Heading size="xl" textAlign="center">
							Sign In
						</Heading>
						<Text textAlign="center" color="gray.600">
							Sign in to Calibre-Web
						</Text>

						{authError && <Alert status="error" title={authError} />}

						<form noValidate onSubmit={handleSubmit(onSubmit)}>
							<Fieldset.Root disabled={isSubmitting || isTestLoggingIn}>
								<Fieldset.Content>
									<Stack gap={4}>
										<Field
											label="Email"
											required
											invalid={!!errors.email}
											errorText={errors.email?.message}
										>
											<Input
												type="email"
												placeholder="example@email.com"
												size="lg"
												{...register("email", {
													required: "Email is required",
													pattern: {
														value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
														message: "Invalid email address",
													},
												})}
											/>
										</Field>

										<Field
											label="Password"
											required
											invalid={!!errors.password}
											errorText={errors.password?.message}
										>
											<Input
												type="password"
												placeholder="••••••••"
												size="lg"
												{...register("password", {
													required: "Password is required",
													minLength: {
														value: 6,
														message: "Password must be at least 6 characters",
													},
												})}
											/>
										</Field>

										<Button
											type="submit"
											colorPalette="blue"
											size="lg"
											width="full"
											loading={isSubmitting}
											mt={4}
										>
											Sign In
										</Button>

										{isDev && (
											<Button
												type="button"
												variant="outline"
												colorPalette="gray"
												size="lg"
												width="full"
												loading={isTestLoggingIn}
												onClick={handleTestLogin}
											>
												Login as Test User
											</Button>
										)}
									</Stack>
								</Fieldset.Content>
							</Fieldset.Root>
						</form>
					</Stack>
				</Box>
			</Container>
		</Flex>
	);
}
