import {
  EC2Client,
  DescribeInstancesCommand,
  TerminateInstancesCommand,
  DescribeImagesCommand,
  DeregisterImageCommand,
  DeleteSnapshotCommand,
} from '@aws-sdk/client-ec2';
import { ImagebuilderClient, DeleteImageCommand } from '@aws-sdk/client-imagebuilder';
import { GetParameterCommand, SSMClient } from '@aws-sdk/client-ssm';

const ec2Client = new EC2Client();
const imagebuilderClient = new ImagebuilderClient();
const ssmClient = new SSMClient();

const expirationInDays = parseInt(process.env.EXPIRATION_IN_DAYS ?? '2');
const imageRecipeName = process.env.IMAGE_RECIPE_NAME;

export const handler = async () => {
  const now = new Date();

  try {
    // Part 1: EC2 Instance garbage collection
    await cleanupEc2Instances(now);

    // Part 2: AMI garbage collection
    await cleanupAmis(now);
  } catch (error) {
    console.error('Error in garbage collection:', error);
    throw error;
  }
};

/**
 * Cleans up stopped EC2 instances that are older than the expiration period
 */
async function cleanupEc2Instances(now: Date) {
  // Filter conditions to search for candidate instances
  const describeParams = {
    Filters: [
      { Name: 'tag-key', Values: ['RemoteSweWorkerId'] },
      { Name: 'instance-state-name', Values: ['stopped'] },
    ],
  };

  try {
    const describeInstancesCommand = new DescribeInstancesCommand(describeParams);
    const response = await ec2Client.send(describeInstancesCommand);

    const instancesForTermination = response.Reservations?.flatMap((reservation) => reservation.Instances || [])
      .filter((instance) => {
        // Extract instances that is started more than a day ago
        const launchTime = instance.LaunchTime;
        if (!launchTime) return false;

        const secondsSinceLaunch = (now.getTime() - launchTime.getTime()) / 1000;
        return secondsSinceLaunch >= expirationInDays * 24 * 3600;
      })
      .map((instance) => instance.InstanceId)
      .filter((id): id is string => id !== undefined);

    if (instancesForTermination && instancesForTermination.length > 0) {
      const terminateCommand = new TerminateInstancesCommand({
        InstanceIds: instancesForTermination,
      });
      await ec2Client.send(terminateCommand);
      console.log(`Terminated ${instancesForTermination.length} instances`);
    } else {
      console.log('No instances to terminate');
    }
  } catch (error: unknown) {
    console.error('Error processing instances:', error);
    throw error;
  }
}

/**
 * Cleans up AMIs that are older than the expiration period and not in use
 */
async function cleanupAmis(now: Date) {
  if (!imageRecipeName) {
    console.log('IMAGE_RECIPE_NAME environment variable not set, skipping AMI cleanup');
    return;
  }

  try {
    // Get the current AMI ID from SSM Parameter Store
    const currentAmiIdParam = await ssmClient.send(new GetParameterCommand({ Name: '/remote-swe/worker/ami-id' }));

    const currentAmiId = currentAmiIdParam.Parameter?.Value;
    if (!currentAmiId) {
      console.log('No current AMI ID found in parameter store');
      return;
    }

    console.log(`Current AMI ID in use: ${currentAmiId}`);

    // Get all AMIs owned by self with name starting with the image recipe name
    const describeImagesResponse = await ec2Client.send(
      new DescribeImagesCommand({
        Owners: ['self'],
        Filters: [
          {
            Name: 'name',
            Values: [`${imageRecipeName}*`],
          },
        ],
      })
    );

    if (!describeImagesResponse.Images || describeImagesResponse.Images.length === 0) {
      console.log('No AMIs found matching the criteria');
      return;
    }

    console.log(`Found ${describeImagesResponse.Images.length} AMIs`);

    const deletePromises = [];

    // Process each AMI
    for (const image of describeImagesResponse.Images) {
      if (!image.ImageId || !image.CreationDate) continue;

      // Skip the AMI that is currently in use
      if (image.ImageId === currentAmiId) {
        console.log(`Skipping current AMI in use: ${image.ImageId}`);
        continue;
      }

      const creationDate = new Date(image.CreationDate);
      const ageInDays = (now.getTime() - creationDate.getTime()) / (1000 * 3600 * 24);

      // Only delete AMIs that are older than 1 day
      if (ageInDays > 1) {
        console.log(`Deleting AMI ${image.ImageId}, created ${image.CreationDate}, age: ${ageInDays.toFixed(2)} days`);

        // Get the Image Builder ARN from tags if available
        let imageBuilderArn = null;
        if (image.Tags) {
          const imageBuilderArnTag = image.Tags.find((tag) => tag.Key === 'Ec2ImageBuilderArn');
          if (imageBuilderArnTag && imageBuilderArnTag.Value) {
            imageBuilderArn = imageBuilderArnTag.Value;
          }
        }

        // 1. Delete the AMI
        deletePromises.push(
          ec2Client
            .send(
              new DeregisterImageCommand({
                ImageId: image.ImageId,
              })
            )
            .then(() => {
              console.log(`Successfully deregistered AMI: ${image.ImageId}`);
            })
            .catch((error: Error) => {
              console.error(`Error deregistering AMI ${image.ImageId}:`, error);
            })
        );

        // 2. Delete associated snapshots
        if (image.BlockDeviceMappings) {
          for (const blockDevice of image.BlockDeviceMappings) {
            if (blockDevice.Ebs && blockDevice.Ebs.SnapshotId) {
              deletePromises.push(
                ec2Client
                  .send(
                    new DeleteSnapshotCommand({
                      SnapshotId: blockDevice.Ebs.SnapshotId,
                    })
                  )
                  .then(() => {
                    console.log(`Successfully deleted snapshot: ${blockDevice.Ebs?.SnapshotId}`);
                  })
                  .catch((error: Error) => {
                    console.error(`Error deleting snapshot ${blockDevice.Ebs?.SnapshotId}:`, error);
                  })
              );
            }
          }
        }

        // 3. Delete the corresponding Image Builder image if ARN is available
        if (imageBuilderArn) {
          deletePromises.push(
            imagebuilderClient
              .send(
                new DeleteImageCommand({
                  imageBuildVersionArn: imageBuilderArn,
                })
              )
              .then(() => {
                console.log(`Successfully deleted Image Builder image: ${imageBuilderArn}`);
              })
              .catch((error: Error) => {
                console.error(`Error deleting Image Builder image ${imageBuilderArn}:`, error);
              })
          );
        }
      } else {
        console.log(`Skipping AMI ${image.ImageId}, too recent (${ageInDays.toFixed(2)} days old)`);
      }
    }

    if (deletePromises.length > 0) {
      await Promise.allSettled(deletePromises);
      console.log(`Deleted ${deletePromises.length} resources (AMIs, snapshots, and Image Builder images)`);
    } else {
      console.log('No AMIs to delete');
    }
  } catch (error: unknown) {
    console.error('Error processing AMIs:', error);
    throw error;
  }
}
