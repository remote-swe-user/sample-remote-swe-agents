import { z } from 'zod';
import { ToolDefinition, zodToJsonSchemaBody } from '../../private/common/lib';
import { promises as fs } from 'fs';
import sharp from 'sharp';

const inputSchema = z.object({
  imagePath: z.string().describe('the local file system path to the image'),
});

const name = 'readLocalImage';

export const readImageTool: ToolDefinition<z.infer<typeof inputSchema>> = {
  name,
  handler: async (input: z.infer<typeof inputSchema>) => {
    // Check if file exists
    await fs.access(input.imagePath);

    // Convert image to webp format using sharp
    const webpBuffer = await sharp(input.imagePath).webp().toBuffer();

    // Convert to Base64
    const base64Data = webpBuffer.toString('base64');
    const dataURI = `data:image/webp;base64,${base64Data}`;

    // Return JSON stringified result with image data
    return JSON.stringify({
      image: {
        type: 'image',
        data: dataURI,
        alt: `Image from ${input.imagePath}`,
      },
    });
  },
  schema: inputSchema,
  toolSpec: async () => ({
    name,
    description: `Read an image from the local file system and return its content as base64 encoded data. This allows agents to process images stored locally.`,
    inputSchema: {
      json: zodToJsonSchemaBody(inputSchema),
    },
  }),
};
