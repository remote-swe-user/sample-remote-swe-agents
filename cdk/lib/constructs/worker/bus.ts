import { Construct } from 'constructs';
import * as appsync from 'aws-cdk-lib/aws-appsync';
import { CfnOutput } from 'aws-cdk-lib';

export interface WorkerBusProps {}

export class WorkerBus extends Construct {
  public readonly httpEndpoint: string;
  public readonly api: appsync.EventApi;

  constructor(scope: Construct, id: string, props: WorkerBusProps) {
    super(scope, id);

    const iamProvider: appsync.AppSyncAuthProvider = {
      authorizationType: appsync.AppSyncAuthorizationType.IAM,
    };

    const api = new appsync.EventApi(this, 'Api', {
      apiName: 'RemoteWorkerEventBus',
      authorizationConfig: {
        authProviders: [iamProvider],
        connectionAuthModeTypes: [appsync.AppSyncAuthorizationType.IAM],
        defaultPublishAuthModeTypes: [appsync.AppSyncAuthorizationType.IAM],
        defaultSubscribeAuthModeTypes: [appsync.AppSyncAuthorizationType.IAM],
      },
    });

    new appsync.ChannelNamespace(this, 'Namespace', {
      api,
      channelNamespaceName: 'event-bus',
    });

    this.httpEndpoint = `https://${api.httpDns}`;
    this.api = api;
  }
}
