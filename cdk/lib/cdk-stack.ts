import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { SlackBolt } from './constructs/slack-bolt';
import { Worker } from './constructs/worker';
import { SubnetType, Vpc } from 'aws-cdk-lib/aws-ec2';
import { Storage } from './constructs/storage';
import { EC2GarbageCollector } from './constructs/ec2-gc';
import { StringParameter } from 'aws-cdk-lib/aws-ssm';
import { BlockPublicAccess, Bucket } from 'aws-cdk-lib/aws-s3';
import { RemovalPolicy } from 'aws-cdk-lib';

export interface MainStackProps extends cdk.StackProps {
  slack: {
    botTokenParameterName: string;
    signingSecretParameterName: string;
    adminUserIdList?: string;
  };
  github:
    | {
        appId: string;
        installationId: string;
        privateKeyParameterName: string;
      }
    | {
        personalAccessTokenParameterName: string;
      };
  loadBalancing?: {
    awsAccounts: string[];
    roleName: string;
  };
}

export class MainStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: MainStackProps) {
    super(scope, id, { ...props, description: `${props.description ?? 'Remote SWE Agents stack'} (uksb-lv52f92xel)` });

    const botToken = StringParameter.fromStringParameterAttributes(this, 'SlackBotToken', {
      parameterName: props.slack.botTokenParameterName,
      forceDynamicReference: true,
    });

    const signingSecret = StringParameter.fromStringParameterAttributes(this, 'SlackSigningSecret', {
      parameterName: props.slack.signingSecretParameterName,
      forceDynamicReference: true,
    });

    const accessLogBucket = new Bucket(this, 'AccessLog', {
      removalPolicy: RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      enforceSSL: true,
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
    });

    const vpc = new Vpc(this, 'VpcV2', {
      subnetConfiguration: [
        {
          subnetType: SubnetType.PUBLIC,
          name: 'Public',
          cidrMask: 20,
        },
      ],
    });

    const storage = new Storage(this, 'Storage', { accessLogBucket });

    const worker = new Worker(this, 'Worker', {
      vpc,
      table: storage.table,
      imageBucket: storage.bucket,
      slackBotTokenParameter: botToken,
      ...('appId' in props.github
        ? {
            gitHubApp: {
              appId: props.github.appId,
              installationId: props.github.installationId,
              privateKeyParameterName: props.github.privateKeyParameterName,
            },
          }
        : {
            githubPersonalAccessTokenParameter: StringParameter.fromStringParameterAttributes(
              this,
              'GitHubPersonalAccessToken',
              {
                parameterName: props.github.personalAccessTokenParameterName,
                forceDynamicReference: true,
              }
            ),
          }),
      loadBalancing: props.loadBalancing,
      accessLogBucket,
    });

    new SlackBolt(this, 'SlackBolt', {
      botTokenParameter: botToken,
      signingSecretParameter: signingSecret,
      launchTemplateId: worker.launchTemplate.launchTemplateId!,
      subnetIdList: vpc.publicSubnets.map((s) => s.subnetId).join(','),
      workerBus: worker.bus,
      table: storage.table,
      bucket: storage.bucket,
      adminUserIdList: props.slack.adminUserIdList,
      workerLogGroupName: worker.logGroup.logGroupName,
    });

    new EC2GarbageCollector(this, 'EC2GarbageCollector');
  }
}
