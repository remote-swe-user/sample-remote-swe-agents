import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';
import { join } from 'path';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';

export interface EC2GarbageCollectorProps {}

export class EC2GarbageCollector extends Construct {
  constructor(scope: Construct, id: string, props?: EC2GarbageCollectorProps) {
    super(scope, id);

    const handler = new NodejsFunction(this, 'Handler', {
      runtime: lambda.Runtime.NODEJS_20_X,
      entry: join(__dirname, 'lambda', 'index.ts'),
      environment: {
        EXPIRATION_IN_DAYS: '1',
      },
      architecture: lambda.Architecture.ARM_64,
      timeout: cdk.Duration.minutes(5),
    });

    handler.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['ec2:DescribeInstances', 'ec2:TerminateInstances'],
        resources: ['*'],
      })
    );

    const schedule = new events.Rule(this, 'Schedule', {
      schedule: events.Schedule.rate(cdk.Duration.hours(2)),
    });

    schedule.addTarget(new targets.LambdaFunction(handler));
  }
}
