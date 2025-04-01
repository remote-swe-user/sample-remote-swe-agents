import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3';

const s3 = new S3Client();
const BucketName = process.env.BUCKET_NAME!;

export const getBytesFromKey = async (key: string) => {
  const { Body } = await s3.send(
    new GetObjectCommand({
      Bucket: BucketName,
      Key: key,
    })
  );
  return Body!.transformToByteArray();
};
