import { z } from 'zod';
import { ToolDefinition, zodToJsonSchemaBody } from '../../private/common/lib';
import { promises as fs } from 'fs';
import { extname } from 'path';

const inputSchema = z.object({
  imagePath: z.string().describe('the local file system path to the image'),
});

const name = 'readLocalImage';

export const readImageTool: ToolDefinition<z.infer<typeof inputSchema>> = {
  name,
  handler: async (input: z.infer<typeof inputSchema>) => {
    try {
      // Check if file exists
      await fs.access(input.imagePath);

      // Read file as binary
      const imageBuffer = await fs.readFile(input.imagePath);

      // Get file extension to determine MIME type
      const ext = extname(input.imagePath).toLowerCase().substring(1);
      let mimeType = 'image/jpeg'; // Default MIME type

      // Set proper MIME type based on file extension
      switch (ext) {
        case 'png':
          mimeType = 'image/png';
          break;
        case 'gif':
          mimeType = 'image/gif';
          break;
        case 'webp':
          mimeType = 'image/webp';
          break;
        case 'svg':
          mimeType = 'image/svg+xml';
          break;
        case 'jpeg':
        case 'jpg':
          mimeType = 'image/jpeg';
          break;
        default:
          throw new Error(`Unsupported image format: ${ext}`);
      }

      // Convert to Base64
      const base64Data = imageBuffer.toString('base64');
      const dataURI = `data:${mimeType};base64,${base64Data}`;

      // Return JSON stringified result with image data
      return JSON.stringify({
        image: {
          type: 'image',
          data: dataURI,
          alt: `Image from ${input.imagePath}`,
        },
      });
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to read image: ${error.message}`);
      }
      throw new Error('Failed to read image due to an unknown error');
    }
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