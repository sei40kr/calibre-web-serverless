"use client";

import {
	Box,
	Button,
	Container,
	Flex,
	Heading,
	Input,
	Stack,
	Text,
} from "@chakra-ui/react";
import { useForm } from "react-hook-form";
import { Field } from "@/components/ui/field";

interface LoginFormData {
	email: string;
	password: string;
}

export default function Home() {
	const {
		register,
		handleSubmit,
		formState: { errors, isSubmitting },
	} = useForm<LoginFormData>();

	const onSubmit = async (data: LoginFormData) => {
		// TODO: Implement login logic here
		console.log("Login attempt:", data);

		// Demo timeout
		await new Promise((resolve) => setTimeout(resolve, 1000));
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

						<form onSubmit={handleSubmit(onSubmit)}>
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
							</Stack>
						</form>
					</Stack>
				</Box>
			</Container>
		</Flex>
	);
}
