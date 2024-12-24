## Example client to call the `generate_image` tool

This example demonstrates how to call the `generate_image` tool from terminal.

### Prerequisites

- build the MCP server
```bash
cd mcp-server-amazon-bedrock
npm install
npm run build
```

### Usage

```bash
cd example-client
npm install
npm run build
node build/index.js
```