import { ToolDefinition, zodToJsonSchemaBody } from '../../common/lib';
import { z } from 'zod';
import { sendMessage } from '../../../common/slack';

const inputSchema = z.object({
  message: z.string().describe('The message you want to send to the user.'),
});

const name = 'reportProgressToUser';

export const reportProgressTool: ToolDefinition<z.infer<typeof inputSchema>> = {
  name,
  handler: async (input: z.infer<typeof inputSchema>) => {
    await sendMessage(input.message, true);
    return 'successfully sent a message.';
  },
  schema: inputSchema,
  toolSpec: async () => ({
    name,
    description: `Send any message to the user. This is especially valuable if the message contains any information the user want to know, such as how you are solving the problem now. Without this tool, a user cannot know your progress because message is only sent when you finished using tools and end your turn. 

!IMPORTANT
Any tool result contains the elapsed time since the last time you sent a message. If it is more than 3 minutes, you should report some progress message using this tool.
      `,
    inputSchema: {
      json: zodToJsonSchemaBody(inputSchema),
    },
  }),
};
