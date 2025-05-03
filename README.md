[![MseeP.ai Security Assessment Badge](https://mseep.net/pr/zxkane-mcp-server-amazon-bedrock-badge.png)](https://mseep.ai/app/zxkane-mcp-server-amazon-bedrock)

# Amazon Bedrock MCP Server

A Model Control Protocol (MCP) server that integrates with Amazon Bedrock's Nova Canvas model for AI image generation.

<a href="https://glama.ai/mcp/servers/9qw7dwpvj9"><img width="380" height="200" src="https://glama.ai/mcp/servers/9qw7dwpvj9/badge" alt="Amazon Bedrock Server MCP server" /></a>

## Features

- High-quality image generation from text descriptions using Amazon's Nova Canvas model
- Advanced control through negative prompts to refine image composition
- Flexible configuration options for image dimensions and quality
- Deterministic image generation with seed control
- Robust input validation and error handling

## Prerequisites

1. Active AWS account with Amazon Bedrock and Nova Canvas model access
2. Properly configured AWS credentials with required permissions
3. Node.js version 18 or later

## Installation

### AWS Credentials Configuration

The server requires AWS credentials with appropriate Amazon Bedrock permissions. Configure these using one of the following methods:

1. Environment variables:
   ```bash
   export AWS_ACCESS_KEY_ID=your_access_key
   export AWS_SECRET_ACCESS_KEY=your_secret_key
   export AWS_REGION=us-east-1  # or your preferred region
   ```

2. AWS credentials file (`~/.aws/credentials`):
   ```ini
   [the_profile_name]
   aws_access_key_id = your_access_key
   aws_secret_access_key = your_secret_key
   ```
   Environment variable for active profile:
   ```bash
   export AWS_PROFILE=the_profile_name
   ```

3. IAM role (when deployed on AWS infrastructure)

### Claude Desktop Integration

To integrate with Claude Desktop, add the following configuration to your settings file:

MacOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
Windows: `%APPDATA%/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "amazon-bedrock": {
      "command": "npx",
      "args": [
        "-y",
        "@zxkane/mcp-server-amazon-bedrock"
      ],
      "env": {
        "AWS_PROFILE": "your_profile_name",         // Optional, only if you want to use a specific profile
        "AWS_ACCESS_KEY_ID": "your_access_key",     // Optional if using AWS credentials file or IAM role
        "AWS_SECRET_ACCESS_KEY": "your_secret_key", // Optional if using AWS credentials file or IAM role
        "AWS_REGION": "us-east-1"                   // Optional, defaults to 'us-east-1'
      }
    }
  }
}
```

## Available Tools

### generate_image

Creates images from text descriptions using Amazon Bedrock's Nova Canvas model.

#### Parameters

- `prompt` (required): Descriptive text for the desired image (1-1024 characters)
- `negativePrompt` (optional): Elements to exclude from the image (1-1024 characters)
- `width` (optional): Image width in pixels (default: 1024)
- `height` (optional): Image height in pixels (default: 1024)
- `quality` (optional): Image quality level - "standard" or "premium" (default: "standard")
- `cfg_scale` (optional): Prompt adherence strength (1.1-10, default: 6.5)
- `seed` (optional): Generation seed for reproducibility (0-858993459, default: 12)
- `numberOfImages` (optional): Batch size for generation (1-5, default: 1)

#### Example Implementation

```typescript
const result = await callTool('generate_image', {
  prompt: "A serene mountain landscape at sunset",
  negativePrompt: "people, buildings, vehicles",
  quality: "premium",
  cfg_scale: 8,
  numberOfImages: 2
});
```

#### Prompt Guidelines

For optimal results, avoid negative phrasing ("no", "not", "without") in the main prompt. Instead, move these elements to the `negativePrompt` parameter. For example, rather than using "a landscape without buildings" in the prompt, use "buildings" in the `negativePrompt`.

For detailed usage guidelines, refer to the [Nova Canvas documentation][nova-canvas-doc].

## Development

To set up and run the server in a local environment:

```bash
git clone https://github.com/zxkane/mcp-server-amazon-bedrock.git
cd mcp-server-amazon-bedrock
npm install
npm run build
```

### Performance Considerations

Generation time is influenced by resolution (`width` and `height`), `numberOfImages`, and `quality` settings. When using higher values, be mindful of potential timeout implications in your implementation.

## License

This project is licensed under the MIT License - see the LICENSE file for details.

[nova-canvas-doc]: https://docs.aws.amazon.com/nova/latest/userguide/image-gen-access.html
