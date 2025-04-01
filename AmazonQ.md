# Remote SWE Agents Knowledge Base

This file provides important information about the Remote SWE Assistant repository. AI agent references this to support its work on this project.

## Project Structure

This project consists of the following main components:

1. **CDK (AWS Cloud Development Kit)** - `/cdk` directory
   - Infrastructure provisioning code
   - AWS resource definitions (Lambda, DynamoDB, EC2, etc.)

2. **Slack Bolt App** - `/slack-bolt-app` directory
   - Slack integration interface
   - API for processing user requests

3. **Worker** - `/worker` directory
   - AI agent implementation
   - Tool suite (GitHub operations, file editing, command execution, etc.)

## Coding Conventions

- Use TypeScript to ensure type safety
- Use Promise-based patterns for asynchronous operations
- Use Prettier for code formatting
- Prefer function-based implementations over classes

## Commonly Used Commands

### Common

```bash
# Format check
npm run format:check

# Code formatting
npm run format

# Build
npm run build
```

### CDK

```bash
# CDK deployment
cd cdk && npx cdk deploy

# List stacks
cd cdk && npx cdk list

# Check stack differences
cd cdk && npx cdk diff
```

### Worker

```bash
# Local execution
cd worker && npm run start:local

# TypeScript-only build
cd worker && npm run build
```

### Slack Bolt App

```bash
# Run in development mode (watch for changes)
cd slack-bolt-app && npm run dev

# Build
cd slack-bolt-app && npm run build
```

## Important Design Information

### DynamoDB Table Design

- **PK**: `message-{workerId}` or `metadata-{workerId}`
- **SK**: Timestamp (for messages) or 'metadata' (for metadata)
- Messages are stored and retrieved for each session

### Repository Metadata

The following information is stored when cloning a repository:
- Repository organization name
- Repository name
- Whether it's a fork
- Local directory path

## Development Flow

1. Create a branch for a new feature or bug fix
2. Implement changes and test
3. Run format and type checks
4. Create a PR and ensure CI passes
5. Merge after review

## Troubleshooting

- **DynamoDB access errors**: Verify AWS credentials are correctly configured
- **Slack app connection errors**: Check that Slack tokens are set in environment variables
- **Build errors**: Check that dependencies are up to date (`npm ci` to update)
- **TypeScript errors**: Ensure type definitions are accurate and use type assertions when necessary
