# Amazon Bedrock MCP Server

An MCP server that provides access to Amazon Bedrock's Nova Canvas model for AI image generation.

## Features

- Generate images from text descriptions using Amazon's Nova Canvas model
- Support for negative prompts to guide what to avoid in the image
- Configurable image dimensions and quality settings
- Reproducible generation with seed control
- Comprehensive input validation and error handling

## Prerequisites

1. An AWS account with access to Amazon Bedrock and Nova Canvas model
2. AWS credentials configured with appropriate permissions
3. Node.js 18 or higher

## Installation

### AWS Credentials Setup

The server requires AWS credentials with permissions to access Amazon Bedrock. You can provide these in several ways:

1. Environment variables:
   ```bash
   export AWS_ACCESS_KEY_ID=your_access_key
   export AWS_SECRET_ACCESS_KEY=your_secret_key
   export AWS_REGION=us-east-1  # or your preferred region
   ```

2. AWS credentials file (`~/.aws/credentials`):
   ```ini
   [default]
   aws_access_key_id = your_access_key
   aws_secret_access_key = your_secret_key
   ```

3. IAM role (if running on AWS)

### Claude Desktop Configuration

To use this with Claude Desktop, add the following to your configuration file:

On MacOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
On Windows: `%APPDATA%/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "amazon-bedrock": {
      "command": "/path/to/mcp-server-amazon-bedrock/build/index.js",
      "env": {
        "AWS_ACCESS_KEY_ID": "your_access_key", // optional if using AWS credentials file or IAM role
        "AWS_SECRET_ACCESS_KEY": "your_secret_key", // optional if using AWS credentials file or IAM role
        "AWS_REGION": "us-east-1" // optional, the default region is 'us-east-1'
      }
    }
  }
}
```

## Available Tools

### generate_image

Generates an image from a text description using Amazon Bedrock's Nova Canvas model.

#### Parameters

- `prompt` (required): Text description of the image to generate (1-1024 characters)
- `negativePrompt` (optional): Text description of what to avoid in the image (1-1024 characters)
- `width` (optional): Width of the generated image (default: 1024)
- `height` (optional): Height of the generated image (default: 1024)
- `quality` (optional): Image quality, either "standard" or "premium" (default: "standard")
- `cfg_scale` (optional): How closely to follow the prompt (1.1-10, default: 6.5)
- `seed` (optional): Seed for reproducible generation (0-858993459, default: 12)
- `numberOfImages` (optional): Number of images to generate (1-5, default: 1)

#### Example Usage

```typescript
const result = await callTool('generate_image', {
  prompt: "A serene mountain landscape at sunset",
  negativePrompt: "people, buildings, vehicles",
  quality: "premium",
  cfg_scale: 8,
  numberOfImages: 2
});
```

#### Note on Prompts

Avoid using negating words ("no", "not", "without", etc.) in your prompts. Instead of including "no mirrors" or "without mirrors" in the prompt, use "mirrors" in the negativePrompt field.

See [Nova Canvas documentation][nova-canvas-doc] for more information on detail usages.

## Error Handling

The server includes comprehensive error handling for:

- Invalid parameters (with specific validation messages)
- AWS credential issues
- Network connectivity problems
- Model availability issues
- Rate limiting
- Content moderation (images that don't align with AWS RAI policy)

Error messages are returned in a user-friendly format with suggestions for resolution.

## Development

To build and run the server locally:

```bash
git clone https://github.com/zxkane/mcp-server-amazon-bedrock.git
cd mcp-server-amazon-bedrock
npm install
npm run build
npm start
```

### Important Note on Timeouts

Resolution (`width` and `height`), `numberOfImages`, and `quality` all impact generation time. When using higher values for these parameters, generation might exceed default timeouts. Consider this when making requests.

## License

MIT License - see LICENSE file for details.

[nova-canvas-doc]: https://docs.aws.amazon.com/nova/latest/userguide/image-gen-access.html