#!/usr/bin/env node
import "source-map-support/register";
import * as cdk from "aws-cdk-lib";
import { AwsCdkParrallelStateMachineBySfnSampleStack } from "../lib/aws-cdk-parrallel-state-machine-by-sfn-sample-stack";

const app = new cdk.App();
new AwsCdkParrallelStateMachineBySfnSampleStack(
  app,
  "AwsCdkParrallelStateMachineBySfnSampleStack",
  {}
);
