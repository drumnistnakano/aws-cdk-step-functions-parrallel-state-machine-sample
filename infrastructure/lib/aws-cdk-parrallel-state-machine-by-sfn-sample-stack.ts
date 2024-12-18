import * as cdk from "aws-cdk-lib";
import * as lambda from "aws-cdk-lib/aws-lambda-nodejs";
import * as logs from "aws-cdk-lib/aws-logs";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as sfn from "aws-cdk-lib/aws-stepfunctions";
import * as tasks from "aws-cdk-lib/aws-stepfunctions-tasks";
import { Construct } from "constructs";

export class AwsCdkParrallelStateMachineBySfnSampleStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // S3バケットの作成
    const bucket = new s3.Bucket(this, "DataBucket", {
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    // Lambda関数の作成
    const generateDataFunction = new lambda.NodejsFunction(
      this,
      "GenerateDataFunction",
      {
        entry: "../server/src/generateData.ts",
        handler: "handler",
        runtime: cdk.aws_lambda.Runtime.NODEJS_22_X,
        environment: {
          BUCKET_NAME: bucket.bucketName,
        },
        bundling: {
          externalModules: ["aws-sdk"],
        },
      }
    );

    const processDataFunction = new lambda.NodejsFunction(
      this,
      "ProcessDataFunction",
      {
        entry: "../server/src/processData.ts",
        handler: "handler",
        runtime: cdk.aws_lambda.Runtime.NODEJS_22_X,
        environment: {
          BUCKET_NAME: bucket.bucketName,
        },
        bundling: {
          externalModules: ["aws-sdk"],
        },
      }
    );

    // S3バケットへのアクセス権限を付与
    bucket.grantReadWrite(generateDataFunction);
    bucket.grantReadWrite(processDataFunction);

    // Step Functionsのログ設定
    const logGroup = new logs.LogGroup(this, "StateMachineLogGroup", {
      logGroupName: "/aws/stepfunctions/ParallelProcessing",
      retention: logs.RetentionDays.ONE_WEEK,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // エラーハンドリング用のステート
    const handleMapError = new sfn.Pass(this, "HandleMapError", {
      parameters: {
        "error.$": "$.error",
        "cause.$": "$.cause",
      },
    });

    // データ生成タスク
    const generateDataTask = new tasks.LambdaInvoke(this, "GenerateData", {
      lambdaFunction: generateDataFunction,
      outputPath: "$.Payload",
    });

    // データ処理タスク
    const processDataTask = new tasks.LambdaInvoke(this, "ProcessData", {
      lambdaFunction: processDataFunction,
      outputPath: "$.Payload",
    }).addCatch(handleMapError, {
      resultPath: "$.error",
    });

    // Map状態の定義
    const processMap = new sfn.Map(this, "ProcessMap", {
      maxConcurrency: 100,
      itemsPath: sfn.JsonPath.stringAt("$.items"),
      parameters: {
        "jobId.$": "$.jobId",
        "index.$": "$$.Map.Item.Value.index",
        "inputLocation.$": "$$.Map.Item.Value.location",
      },
      resultPath: "$.mapResults",
    });

    processMap.iterator(processDataTask);

    // 成功・失敗の判定ステート
    const success = new sfn.Succeed(this, "Success");
    const failed = new sfn.Fail(this, "Failed", {
      error: "MapStateError",
      cause: "Error in map state execution",
    });

    // エラーチェックの条件分岐
    const checkError = new sfn.Choice(this, "CheckError")
      .when(sfn.Condition.isPresent("$.error"), failed)
      .otherwise(success);

    // ステートマシンの定義
    const stateMachine = new sfn.StateMachine(
      this,
      "ParallelProcessingStateMachine",
      {
        definition: generateDataTask.next(processMap).next(checkError),
        logs: {
          destination: logGroup,
          level: sfn.LogLevel.ALL,
          includeExecutionData: true,
        },
        tracingEnabled: true,
        timeout: cdk.Duration.hours(1),
      }
    );

    // 出力
    new cdk.CfnOutput(this, "StateMachineArn", {
      value: stateMachine.stateMachineArn,
      description: "State Machine ARN",
    });

    new cdk.CfnOutput(this, "BucketName", {
      value: bucket.bucketName,
      description: "S3 Bucket Name",
    });
  }
}
