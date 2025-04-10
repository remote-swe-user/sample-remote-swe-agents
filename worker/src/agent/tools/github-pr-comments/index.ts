import { ToolDefinition, zodToJsonSchemaBody } from '../../common/lib';
import { z } from 'zod';
import { executeCommand } from '../command-execution';
import { authorizeGitHubCli } from '../command-execution/github';

// Get PR comments schema
const getPRCommentsSchema = z.object({
  owner: z.string().describe('GitHub repository owner'),
  repo: z.string().describe('GitHub repository name'),
  pullRequestId: z.string().describe('The sequential number of the pull request issued from GitHub'),
});

// Reply to PR comment schema
const replyPRCommentSchema = z.object({
  owner: z.string().describe('GitHub repository owner'),
  repo: z.string().describe('GitHub repository name'),
  pullRequestId: z.string().describe('The sequential number of the pull request issued from GitHub'),
  commentId: z.string().describe('ID of the comment to reply to'),
  body: z.string().describe('The text of the reply comment'),
});

// Handler for getting PR comments
const getPRCommentsHandler = async (input: z.infer<typeof getPRCommentsSchema>) => {
  const { owner, repo, pullRequestId } = input;

  try {
    // Use GitHub CLI to get PR comments
    const result = await executeCommand(
      `gh api repos/${owner}/${repo}/pulls/${pullRequestId}/comments --jq '.[] | {id: .id, user: .user.login, body: .body, path: .path, position: .position, created_at: .created_at, html_url: .html_url}'`
    );

    if (result.error) {
      return `Failed to get PR comments: ${result.error}`;
    }

    if (!result.stdout.trim()) {
      return 'No review comments found for this PR.';
    }

    return result.stdout;
  } catch (error: any) {
    return `Error retrieving PR comments: ${error.message}`;
  }
};

// Handler for replying to PR comments
const replyPRCommentHandler = async (input: z.infer<typeof replyPRCommentSchema>) => {
  const { owner, repo, pullRequestId, commentId, body } = input;

  // Ensure GitHub CLI is authenticated
  await authorizeGitHubCli();

  try {
    // Use GitHub CLI to reply to a comment
    const result = await executeCommand(
      `gh api --method POST repos/${owner}/${repo}/pulls/${pullRequestId}/comments/${commentId}/replies -f body="${body}"`
    );

    if (result.error) {
      return `Failed to reply to comment: ${result.error}`;
    }

    return `Successfully replied to comment ${commentId}`;
  } catch (error: any) {
    return `Error replying to comment: ${error.message}`;
  }
};

// Tool definitions
export const getPRCommentsTool: ToolDefinition<z.infer<typeof getPRCommentsSchema>> = {
  name: 'getPRComments',
  handler: getPRCommentsHandler,
  schema: getPRCommentsSchema,
  toolSpec: async () => ({
    name: 'getPRComments',
    description: 'Get review comments for a specific GitHub PR.',
    inputSchema: {
      json: zodToJsonSchemaBody(getPRCommentsSchema),
    },
  }),
};

export const replyPRCommentTool: ToolDefinition<z.infer<typeof replyPRCommentSchema>> = {
  name: 'replyPRComment',
  handler: replyPRCommentHandler,
  schema: replyPRCommentSchema,
  toolSpec: async () => ({
    name: 'replyPRComment',
    description: 'Reply to a specific comment in a GitHub pull request.',
    inputSchema: {
      json: zodToJsonSchemaBody(replyPRCommentSchema),
    },
  }),
};
