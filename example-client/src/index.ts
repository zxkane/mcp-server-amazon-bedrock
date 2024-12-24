import path from 'path';
import { fileURLToPath } from 'url';
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import {
  ListToolsResultSchema,
  CallToolResultSchema
} from "@modelcontextprotocol/sdk/types.js";
import terminalImage from "terminal-image";

async function main() {
  // Get the current file's directory
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);

  // Initialize the client
  const client = new Client(
    {
      name: "example-bedrock-client",
      version: "1.0.0",
    },
    {
      capabilities: {},
    }
  );

  try {
    // Use path.resolve to get the correct path to the server script
    const transport = new StdioClientTransport({
      command: path.resolve(__dirname, "../../build/index.js"),
      env: {
        ...process.env, // Pass all environment variables
        NODE_ENV: process.env.NODE_ENV || 'development',
      }
    });
    await client.connect(transport);
    console.log("Connected to Amazon Bedrock MCP server");

    // List available tools
    const tools = await client.request(
      { method: "tools/list" },
      ListToolsResultSchema
    );
    console.log("Available tools:", tools);

    // Log start time
    const startTime = new Date();
    console.log(`Image Generation Request started at: ${startTime.toISOString()}`);

    // Example: Generate an image using the generate_image tool
    const imageResult = await client.request(
      {
        method: "tools/call",
        params: {
          name: "generate_image",
          arguments: {
            prompt: "A serene landscape with mountains and a lake at sunset",
            width: 1024,
            height: 1024,
            quality: "standard", 
            cfg_scale: 7,
            seed: 42,
            numberOfImages: 2,
          },
        },
      },
      CallToolResultSchema
    );
    // Log end time and duration
    const endTime = new Date();
    const duration = endTime.getTime() - startTime.getTime();

    if (imageResult.content && imageResult.content.length > 0) {
      for (const content of imageResult.content) {
        if (content.type === "image") {
          console.log("Image generated successfully!");
          try {
            const buffer = Buffer.from(content.data, 'base64');
            console.log(await terminalImage.buffer(buffer));
          } catch (err) {
            console.error('Error displaying image:', err);
          }
        } else if (content.type === "text") {
          console.log("Text generated:", content.text);
        }
      }
    }

    console.log(`Request completed at: ${endTime.toISOString()}`);
    console.log(`Total duration: ${duration}ms`);

    // Clean up
    await client.close();
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
}

// Handle interrupts
process.on("SIGINT", () => {
  console.log("Interrupted, exiting...");
  process.exit(0);
});

main().catch(console.error);
