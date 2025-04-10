import z from 'zod';
import { Octokit } from '@octokit/rest';
import { authorizeGitHubCli } from '../command-execution/github';

const getPRCommentsSchema = z.object({
  owner: z.string().describe('GitHub repository owner'),
  repo: z.string().describe('GitHub repository name'),
  pullRequestId: z.string().describe('The sequential number of the pull request issued from GitHub'),
});

type GetPRCommentsParams = z.infer<typeof getPRCommentsSchema>;

const replyPRCommentSchema = z.object({
  owner: z.string().describe('GitHub repository owner'),
  repo: z.string().describe('GitHub repository name'),
  pullRequestId: z.string().describe('The sequential number of the pull request issued from GitHub'),
  commentId: z.string().describe('ID of the comment to reply to'),
  body: z.string().describe('The text of the reply comment'),
});

type ReplyPRCommentParams = z.infer<typeof replyPRCommentSchema>;

/**
 * Gets the review comments for a specific pull request
 */
export const getPRComments = async (params: GetPRCommentsParams) => {
  const { owner, repo, pullRequestId } = params;
  
  // Get GitHub token
  const token = await authorizeGitHubCli();
  
  // Initialize Octokit
  const octokit = new Octokit({
    auth: token,
  });

  try {
    // Get PR review comments
    const { data: comments } = await octokit.pulls.listReviewComments({
      owner,
      repo,
      pull_number: parseInt(pullRequestId, 10),
    });

    // Format the comments for better readability
    const formattedComments = comments.map((comment) => ({
      id: comment.id.toString(),
      user: comment.user?.login || 'Unknown',
      body: comment.body || '',
      path: comment.path,
      position: comment.position,
      createdAt: comment.created_at,
      url: comment.html_url,
    }));

    return {
      success: true,
      comments: formattedComments,
    };
  } catch (error: any) {
    return {
      success: false,
      error: `Failed to get PR comments: ${error.message}`,
    };
  }
};

/**
 * Replies to a specific pull request review comment
 */
export const replyPRComment = async (params: ReplyPRCommentParams) => {
  const { owner, repo, commentId, body } = params;
  
  // Get GitHub token
  const token = await authorizeGitHubCli();
  
  // Initialize Octokit
  const octokit = new Octokit({
    auth: token,
  });

  try {
    // Reply to the comment
    const { data } = await octokit.pulls.createReplyForReviewComment({
      owner,
      repo,
      comment_id: parseInt(commentId, 10),
      body,
    });

    return {
      success: true,
      reply: {
        id: data.id.toString(),
        url: data.html_url,
      }
    };
  } catch (error: any) {
    return {
      success: false,
      error: `Failed to reply to comment: ${error.message}`,
    };
  }
};

// Export schemas for the agent to use
export const schemas = {
  getPRComments: getPRCommentsSchema,
  replyPRComment: replyPRCommentSchema,
};