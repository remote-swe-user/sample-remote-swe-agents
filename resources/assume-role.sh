# Variable definitions
SOURCE_ACCOUNT="" # AWS account ID that will assume the role
ROLE_NAME="bedrock-remote-swe-role" # Name of the role to be created

# Create trust policy (temporary file)
cat > trust-policy.json << EOF
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Principal": {
                "AWS": "arn:aws:iam::${SOURCE_ACCOUNT}:root"
            },
            "Action": "sts:AssumeRole",
            "Condition": {}
        }
    ]
}
EOF

# Create permission policy (temporary file) - Example of Bedrock invoke permissions
cat > permission-policy.json << EOF
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "bedrock:InvokeModel"
            ],
            "Resource": [
                "*"
            ]
        }
    ]
}
EOF

# Create the role
aws iam create-role \
    --role-name ${ROLE_NAME} \
    --assume-role-policy-document file://trust-policy.json \
    --no-cli-pager

# Add inline policy
aws iam put-role-policy \
    --role-name ${ROLE_NAME} \
    --policy-name "BedrockRuntimePolicy" \
    --policy-document file://permission-policy.json \
    --no-cli-pager

# Delete temporary files
rm trust-policy.json permission-policy.json

# Display the ARN of the created role
aws iam get-role --role-name ${ROLE_NAME} --query 'Role.Arn' --output text --no-cli-pager
