# Remote SWE Agents

This is an example implementation of an fully autonomous software development AI agent. The agent works in its own dedicated development environment, which means you are now free from your laptops!

![Concept](./docs/imgs/concept.png)

## Key Features

* Fully autonomous software development agent
* Powered by AWS serverless services with minimal maintenance costs
* No upfront or fixed costs while you don't use the system
* MCP integration (tool servers)
* Unlimited context window (middle-out)
* Read knowledge from your favorite format (.clinerules, CLAUDE.md, etc.)
* Can work on OSS forked repositories!

## Installation Steps

Since this project is fully self-hosted, the setup process requires several manual operations such as Slack app setup.
Please carefully follow all the steps below, and if you find any problem, we are willing to help you in GitHub issues!

### Prerequisites

- Node.js (version 20 or higher)
- npm (version 9 or higher)
- AWS CLI
- AWS IAM profile with appropriate permissions
- Slack Workspace
- GitHub Account

### 1. Clone the Repository

```bash
git clone [repository-url]
cd remote-assistant
```

### 2. Run CDK Deploy

Before cdk deploy, you have to create placeholder SSM parameters which will later be populated with the actual values:

```bash
aws ssm put-parameter \
    --name /remote-swe/slack/bot-token \
    --value "placeholder" \
    --type String

aws ssm put-parameter \
    --name /remote-swe/slack/signing-secret \
    --value "placeholder" \
    --type String

aws ssm put-parameter \
    --name /remote-swe/github/personal-access-token \
    --value "placeholder" \
    --type String
```

Then you can run cdk deploy. Note that the above parameter names are referenced in `bin/cdk.ts`.

```bash
npm ci
cd cdk && npm ci
npx cdk bootstrap
npx cdk deploy
```

Deployment usually takes about 5 minutes. After the deployment, you should see the endpoint of your Slack Bolt app. Please continue to the next step.

### 3. Slack App Setup

Now, you have to setup a Slack App to control agents from Slack interface.

#### Create a Slack App

1. Go to [Slack API Dashboard](https://api.slack.com/apps)
2. Click "Create New App"
3. Choose "From manifest"
4. Use the provided Slack app manifest YAML file: [manifest.json](./resources/slack-app-manifest.json)
   - Please replace the endpoint URL (`https://redacted.execute-api.us-east-1.amazonaws.com`) to the actual one
5. Please take a note of the below values:
   - Signing Secret (Basic Information)
   - Bot Token (OAuth & Permission, after installing it to your workspace)

> [!NOTE]
> If you want to use a shared (not personal) Slack workspace, you may want to set `ADMIN_USER_ID_LIST` environment variable (see below) to control who can access the agents. Without setting this property, anyone in the workspace can access the agents and eventually your GitHub contents.


#### Create SSM Parameters for slack secrets

```bash
aws ssm put-parameter \
    --name /remote-swe/slack/bot-token \
    --value "your-slack-bot-token" \
    --type String

aws ssm put-parameter \
    --name /remote-swe/slack/signing-secret \
    --value "your-slack-signing-secret" \
    --type String
```

Replace `your-slack-bot-token` and `your-slack-signing-secret` with the actual values obtained from the above step.


### 4. GitHub Integration

You have two options for GitHub integration:

#### Option 1: Personal Access Token (PAT)

1. Go to [GitHub Settings > Developer settings > Personal access tokens](https://github.com/settings/tokens)
2. Generate a new token with appropriate repository access
   * Required scopes: `admin:read, repo, workflow`
3. Create SSM Parameter
   ```bash
   aws ssm put-parameter \
      --name /remote-swe/github/personal-access-token \
      --value "your-access-token" \
      --type String
   ```

> [!NOTE]
> If you want to share the system with multiple developers, it is recommended to create a [machine user account for GitHub](https://docs.github.com/en/get-started/learning-about-github/types-of-github-accounts#user-accounts) instead of using your own account's PAT, to prevent misuse of personal privileges.

#### Option 2: GitHub App

1. Go to [GitHub Settings > Developer settings > GitHub Apps](https://github.com/settings/apps)
2. Create a new GitHub App
3. Configure permissions and generate a private key
   - the required permissions: Actions(RW), Issues(RW), Pull requests(RW), Contents(RW)
4. Create a parameter of [AWS Systems Manager Parameter Store](https://console.aws.amazon.com/systems-manager/parameters) for the private key.
   - This parameter will be referenced from CDK (the default parameter name: `/remote-swe/github/app-private-key`).
5. Install the app to a GitHub organization you want to use.
   - After installing the app, you can find the installation id from the URL (`https://github.com/organizations/<YOUR_ORG>/settings/installations/<INSTALLATION_ID>`)
6. Please take a note of the below values:
   - App ID (e.g. 12345678)
   - Installation ID (e.g. 12345678)
   - Private key parameter name in AWS Systems Manager Parameter Store

> [!NOTE]
> Currently when using with GitHub App, you can only use repositories under a single organization (i.e. app installation).

### 5. Environment Variables Setup

The following environment variables are required for deployment:

#### For GitHub App Integration:

When you use GitHub App integration (option 2 above), you must set the below two environment variables when deploying CDK.

```sh
export GITHUB_APP_ID=your-github-app-id
export GITHUB_INSTALLATION_ID=your-github-installation-id
```

> [!NOTE]
> We use environment variables here to inject our configuration from GitHub Actions variables. If it is not convenient for you, you can just hard-code the values to [`bin/cdk.ts`](cdk/bin/cdk.ts`).

#### (optional) Restrict access to the system from the Slack

When you want to control which members in the Slack workspace can access the agents, you can pass a comma-separated list of Slack User IDs as the below environment variable.

To get a member's Slack user ID, [follow this instructions](https://www.google.com/search?q=copy+member+id+slack).

```sh
export ADMIN_USER_ID_LIST=U123ABC456,U789XYZ012
```

Then all the users except the specified user IDs will see a Unauthorized error when they try to access the Slack app.

> [!NOTE]
> When you want to allow a user to access the app, you can mention the app with `approve_user` message and then following mention to the users. e.g. `@remote-swe approve_user @Alice @Bob @Carol`

### 6. Deploy CDK again with configuration variables

After the above setup is complete, run `cdk deploy` again.

```bash
cd cdk
npx cdk deploy
```

Then you can access all the features from Slack. Mention the Slack app, and start assign any tasks to the agents!

## How it works

This system utilizes a Slack Bolt application to manage user interactions and implement a scalable worker system. Here's the main workflow:

1. **Message Reception and Processing**
   - When a user sends a message in Slack, it's forwarded to the Slack Bolt application via webhook
   - API Gateway receives the webhook request and passes it to a Lambda function

2. **Event Management and Message Distribution**
   - The Lambda function publishes user messages to AppSync Events
   - Message history is stored in DynamoDB for reference in subsequent processing

3. **Worker System Management**
   - When a new Slack thread is created, the Worker Manager is notified
   - The Worker Manager provisions a Worker Unit consisting of an EC2 instance and EBS volume
   - Each Worker Unit contains an SWE agent responsible for the actual processing

4. **Feedback Loop**
   - Worker Units subscribe to AppSync Events to receive user messages
   - Processing results and progress updates are sent back to Slack as replies to the user
   - Job statuses are managed in DynamoDB

This architecture enables a scalable and reliable messaging processing system. The combination of serverless components (Lambda, API Gateway) and dedicated EC2 instances per worker ensures resource isolation and flexible scalability.

![AWS architecture](./docs/imgs/architecture.png)

## Cost

The following table provides a sample cost breakdown for deploying this system in the us-east-1 (N. Virginia) region for one month.

Here we assume you request 100 sessions per month. The monthly cost is proportional to the number of sessions. (e.g. If you only run 20 session/month, multiply it with 20/100.)

| AWS service | Dimensions | Cost [USD/month] |
|-------------|------------|------------------|
| EC2 | t3.large, 1 hour/session | 8.32 |
| EBS | 50 GB/instance, 1 day/instance | 13.33 |
| DynamoDB | Read: 1000 RRU/session | 0.0125 |
| DynamoDB | Write: 200 WRU/session | 0.0125 |
| DynamoDB | Storage: 2 MB/session | 0.05 |
| AppSync Events | Requests: 20 events/session | 0.002 |
| AppSync Events | Connection: 1 hour/session | 0.00048 |
| Lambda | Requests: 30 invocations/session | 0.0006 |
| Lambda | Duration: 128MB, 1s/invocation | 0.00017 |
| API Gateway | Requests: 20 requests/session | 0.002 |
| Bedrock | Input: Sonnet 3.7 400k tokens/session | 120.00 |
| Bedrock | Output: Sonnet 3.7 20k tokens/session | 30.00 |
| TOTAL | | 171.73 |

Also, as long as you do not use the system (i.e. not sending any messages to the agents), the incurring costs are minimal (~0 USD).

## Clean up
You can clean up all the resources you created by the following commands:

```sh
npx cdk destroy --force
```

## Security

See [CONTRIBUTING](CONTRIBUTING.md#security-issue-notifications) for more information.

## License

This library is licensed under the MIT-0 License. See the LICENSE file.

