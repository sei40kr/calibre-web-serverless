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
	Link,
	Stack,
	Text,
} from "@chakra-ui/react";
import NextLink from "next/link";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Alert } from "@/components/ui/alert";
import { Field } from "@/components/ui/field";

interface ResetPasswordFormData {
	email: string;
}

export default function ResetPassword() {
	const [authError, setAuthError] = useState<string | null>(null);
	const [submitted, setSubmitted] = useState(false);
	const {
		register,
		handleSubmit,
		formState: { errors, isSubmitting },
	} = useForm<ResetPasswordFormData>();

	const onSubmit = async (data: ResetPasswordFormData) => {
		setAuthError(null);
		try {
			await authService.sendPasswordResetEmail(data.email);
			setSubmitted(true);
		} catch (error) {
			if (error instanceof AuthError) {
				switch (error.code) {
					case "invalid-email":
						setAuthError("Invalid email address");
						break;
					case "too-many-requests":
						setAuthError("Too many attempts. Please try again later");
						break;
					default:
						setAuthError("Failed to send password reset email");
				}
			} else {
				setAuthError("An unexpected error occurred");
			}
		}
	};

	return (
		<Flex minH="100vh" align="center" justify="center" bg="bg.subtle">
			<Container maxW="md">
				<Box
					p={8}
					borderWidth={1}
					borderRadius="lg"
					boxShadow="lg"
					bg="bg.panel"
				>
					<Stack gap={6}>
						<Heading size="xl" textAlign="center">
							Reset Password
						</Heading>
						<Text textAlign="center" color="fg.muted">
							Enter your email and we'll send you a link to reset your password
						</Text>

						{submitted ? (
							<Stack gap={6}>
								<Alert status="success" title="Password reset email sent">
									If an account exists for that email, you'll receive a link to
									reset your password shortly.
								</Alert>
								<Link asChild colorPalette="blue" alignSelf="center">
									<NextLink href="/">Back to sign in</NextLink>
								</Link>
							</Stack>
						) : (
							<>
								{authError && <Alert status="error" title={authError} />}

								<form noValidate onSubmit={handleSubmit(onSubmit)}>
									<Fieldset.Root disabled={isSubmitting}>
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
																value:
																	/^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
																message: "Invalid email address",
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
													Send Reset Link
												</Button>

												<Link asChild colorPalette="blue" alignSelf="center">
													<NextLink href="/">Back to sign in</NextLink>
												</Link>
											</Stack>
										</Fieldset.Content>
									</Fieldset.Root>
								</form>
							</>
						)}
					</Stack>
				</Box>
			</Container>
		</Flex>
	);
}
