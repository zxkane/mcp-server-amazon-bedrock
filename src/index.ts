#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from "@modelcontextprotocol/sdk/types.js";
import { BedrockRuntimeClient, InvokeModelCommand } from "@aws-sdk/client-bedrock-runtime";
import { NodeHttpHandler } from "@smithy/node-http-handler";
import { fromNodeProviderChain, fromIni } from "@aws-sdk/credential-providers";
import { z } from "zod";

const AWS_REGION = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || 'us-east-1';
const AWS_PROFILE = process.env.AWS_PROFILE || 'default';

// Log AWS configuration for debugging
console.error('AWS Configuration:', {
  region: AWS_REGION,
  profile: AWS_PROFILE,
  hasAccessKeyId: !!process.env.AWS_ACCESS_KEY_ID,
  hasSecretKey: !!process.env.AWS_SECRET_ACCESS_KEY,
  hasSessionToken: !!process.env.AWS_SESSION_TOKEN
});

// Initialize Bedrock client with comprehensive configuration including credentials and timeouts
const bedrock = new BedrockRuntimeClient({
  region: AWS_REGION,
  maxAttempts: 3,
  // Try explicit profile credentials first, then fall back to provider chain
  credentials: async () => {
    try {
      // First try loading from profile
      const profileCreds = await fromIni({ profile: AWS_PROFILE })();
      console.error('Successfully loaded credentials from profile');
      return profileCreds;
    } catch (error) {
      console.error('Failed to load profile credentials, falling back to provider chain:', error);
      try {
        // Fall back to provider chain
        const chainCreds = await fromNodeProviderChain()();
        console.error('Successfully loaded credentials from provider chain');
        return chainCreds;
      } catch (error) {
        console.error('Failed to load credentials from provider chain:', error);
        throw error;
      }
    }
  },
  requestHandler: new NodeHttpHandler({
    connectionTimeout: 10000, // 10 seconds connection timeout
    requestTimeout: 300000, // 5 minutes request timeout
  })
});

// Log Bedrock client initialization
console.error('Bedrock client initialized');

// Constants
const NOVA_MODEL_ID = 'amazon.nova-canvas-v1:0';

// Input validation schemas based on AWS Nova documentation
const GenerateImageSchema = z.object({
  prompt: z.string().min(1).max(1024, "Prompt must be 1-1024 characters"),
  negativePrompt: z.string().min(1).max(1024, "Negative prompt must be 1-1024 characters").optional(),
  width: z.number().int()
    .min(320, "Width must be at least 320 pixels")
    .max(4096, "Width must be at most 4096 pixels")
    .refine(val => val % 16 === 0, "Width must be divisible by 16")
    .default(1024),
  height: z.number().int()
    .min(320, "Height must be at least 320 pixels")
    .max(4096, "Height must be at most 4096 pixels")
    .refine(val => val % 16 === 0, "Height must be divisible by 16")
    .default(1024),
  quality: z.enum(["standard", "premium"]).default("standard"),
  cfg_scale: z.number().min(1.1).max(10).default(6.5),
  seed: z.number().int().min(0).max(858993459).default(12),
  numberOfImages: z.number().int().min(1).max(5).default(1)
}).refine(
  (data) => {
    // Check aspect ratio between 1:4 and 4:1
    const ratio = data.width / data.height;
    return ratio >= 0.25 && ratio <= 4;
  },
  "Aspect ratio must be between 1:4 and 4:1"
).refine(
  (data) => {
    // Check total pixel count
    return data.width * data.height < 4194304;
  },
  "Total pixel count must be less than 4,194,304"
);

type GenerateImageInput = z.infer<typeof GenerateImageSchema>;

// Constants for image generation
const GENERATION_TYPES = {
  TEXT_TO_IMAGE: "TEXT_IMAGE",
};

/**
 * Create an MCP server for Amazon Bedrock image generation
 */
const server = new Server(
  {
    name: "mcp-server-amazon-bedrock",
    version: "0.1.0",
  },
  {
    capabilities: {
      tools: {},
      logging: {},
    },
  }
);

/**
 * Handler that lists available tools.
 * Exposes a single "generate_image" tool that generates images using Amazon Bedrock.
 */
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "generate_image",
        description: "Generate image(s) using Amazon Nova Canvas model. The returned data is Base64-encoded string that represent each image that was generated.",
        inputSchema: {
          type: "object",
          properties: {
            prompt: {
              type: "string",
              description: "Text description of the image to generate (1-1024 characters)",
            },
            negativePrompt: {
              type: "string",
              description: "Optional text description of what to avoid in the image (1-1024 characters)",
            },
            width: {
              type: "number",
              description: "Width of the generated image (default: 1024)",
            },
            height: {
              type: "number",
              description: "Height of the generated image (default: 1024)",
            },
            quality: {
              type: "string",
              enum: ["standard", "premium"],
              description: "Quality of the generated image (default: standard)",
            },
            cfg_scale: {
              type: "number",
              description: "How closely to follow the prompt (1.1-10, default: 6.5)",
            },
            seed: {
              type: "number",
              description: "Seed for reproducible generation (0-858993459, default: 12)",
            },
            numberOfImages: {
              type: "number",
              description: "Number of images to generate (1-5, default: 1)",
            },
          },
          required: ["prompt"],
        },
      },
    ],
  };
});

interface BedrockResponse {
  images: string[];
  error?: string;
}
/**
 * Handler for the generate_image tool.
 * Uses Amazon Bedrock to generate an image based on the provided parameters.
 */
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  if (request.params.name !== "generate_image") {
    throw new McpError(
      ErrorCode.MethodNotFound,
      `Unknown tool: ${request.params.name}`
    );
  }

  try {
    // Validate and parse input
    const args = GenerateImageSchema.parse(request.params.arguments);
    
    server.sendLoggingMessage({
      level: "info",
      data: `Configuration: ${JSON.stringify({
        width: args.width,
        height: args.height,
        quality: args.quality,
        numberOfImages: args.numberOfImages,
        cfgScale: args.cfg_scale,
        seed: args.seed
      })}`,
    });

    const progressToken = request.params._meta?.progressToken;

    server.sendLoggingMessage({
      level: "info",
      data: "Sending request to Bedrock API...",
    });

    const response = await bedrock.send(new InvokeModelCommand({
      modelId: NOVA_MODEL_ID,
      contentType: "application/json",
      accept: "application/json",
      body: JSON.stringify({
        taskType: GENERATION_TYPES.TEXT_TO_IMAGE,
        textToImageParams: {
          text: args.prompt,
          negativeText: args.negativePrompt || undefined,
        },
        imageGenerationConfig: {
          numberOfImages: args.numberOfImages,
          height: args.height,
          width: args.width,
          quality: args.quality,
          cfgScale: args.cfg_scale,
          seed: args.seed
        },
      }),
    }));

    server.sendLoggingMessage({
      level: "info",
      data: "Received response from Bedrock API",
    });

    if (!response.body) {
      server.sendLoggingMessage({
        level: "error",
        data: "No response body received from Bedrock",
      });
      throw new McpError(
        ErrorCode.InternalError,
        "No response body received from Bedrock"
      );
    }

    const responseBody = JSON.parse(new TextDecoder().decode(response.body)) as BedrockResponse;

    if (!responseBody.images || responseBody.images.length === 0) {
      server.sendLoggingMessage({
        level: "error",
        data: "No image data in response",
      });
      throw new McpError(
        ErrorCode.InternalError,
        `No image data in response due to ${responseBody.error}.`
      );
    }

    server.sendLoggingMessage({
      level: "info",
      data: "Successfully generated image",
    });

    // Return the response in the correct MCP format
    return {
      content: [
        {
          type: "text",
          text: `This is the image generated for your request '${args.prompt}'.`,
        },
        ...responseBody.images.map(image => ({
          type: "image",
          data: image as string,
          mimeType: "image/png",
        })),
        {
          type: "text",
          text: "This is the end of the image generation.",
        }
      ],
    };
  } catch (error) {
    console.error('Error:', error);

    // Handle Zod validation errors
    if (error instanceof z.ZodError) {
      throw new McpError(
        ErrorCode.InvalidParams,
        `Invalid parameters: ${error.errors.map(e => e.message).join(", ")}`
      );
    }

    // Handle AWS Bedrock errors
    if (error instanceof Error) {
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to generate image: ${error.message}`
      );
    }

    // Handle unknown errors
    throw new McpError(
      ErrorCode.InternalError,
      "An unexpected error occurred"
    );
  }
});

/**
 * Start the server using stdio transport.
 */
async function main() {
  try {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error('Amazon Bedrock MCP server running on stdio');
  } catch (error) {
    console.error('Failed to start MCP server:', error);
    throw error;
  }
}

// Error handling
server.onerror = (error) => console.error('[MCP Error]', error);
process.on('SIGINT', async () => {
  await server.close();
  process.exit(0);
});

main().catch((error) => {
  console.error("Server error:", error);
  process.exit(1);
});
