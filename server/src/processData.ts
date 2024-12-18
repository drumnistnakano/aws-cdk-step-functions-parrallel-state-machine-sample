import {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import { Context } from "aws-lambda";

const s3Client = new S3Client({});

export const handler = async (event: any, context: Context) => {
  const { jobId, inputLocation } = event;

  // S3からデータを読み込む
  const getResponse = await s3Client.send(
    new GetObjectCommand({
      Bucket: inputLocation.bucket,
      Key: inputLocation.key,
    })
  );

  const csvContent = await getResponse.Body?.transformToString();
  if (!csvContent) {
    throw new Error("No content found");
  }

  // CSVデータを処理
  const rows = csvContent.split("\n").map((row) => {
    const [id, value, timestamp] = row.split(",");
    return {
      id,
      value: parseFloat(value),
      timestamp,
    };
  });

  // データ処理（この例では単純に値を2倍にする）
  const processedRows = rows.map((row) => ({
    ...row,
    value: row.value * 2,
  }));

  // 処理結果をCSVに変換
  const processedCsvContent = processedRows
    .map((row) => `${row.id},${row.value},${row.timestamp}`)
    .join("\n");

  // 処理結果をS3に保存
  const outputKey = inputLocation.key.replace("/data/", "/processed/");
  await s3Client.send(
    new PutObjectCommand({
      Bucket: inputLocation.bucket,
      Key: outputKey,
      Body: processedCsvContent,
      ContentType: "text/csv",
    })
  );

  return {
    statusCode: 200,
    jobId,
    outputLocation: {
      bucket: inputLocation.bucket,
      key: outputKey,
    },
  };
};
