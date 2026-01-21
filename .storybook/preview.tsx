import { ChakraProvider, defaultSystem } from "@chakra-ui/react";
import type { Preview } from "@storybook/nextjs-vite";

const preview: Preview = {
	parameters: {
		controls: {
			matchers: {
				color: /(background|color)$/i,
				date: /Date$/i,
			},
		},
		nextjs: {
			appDirectory: true,
		},
		a11y: {
			test: "todo",
		},
	},
	decorators: [
		(Story) => (
			<ChakraProvider value={defaultSystem}>
				<Story />
			</ChakraProvider>
		),
	],
};

export default preview;
