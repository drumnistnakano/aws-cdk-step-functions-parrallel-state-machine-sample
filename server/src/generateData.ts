import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { Context } from "aws-lambda";

const s3Client = new S3Client({});

export const handler = async (event: any, context: Context) => {
  const { jobId, index } = event;

  // サンプルデータの生成
  const data = Array.from({ length: 1000 }, (_, i) => ({
    id: `${index}-${i}`,
    value: Math.random(),
    timestamp: new Date().toISOString(),
  }));

  // CSVデータの作成
  const csvContent = data
    .map((row) => `${row.id},${row.value},${row.timestamp}`)
    .join("\n");

  // S3にアップロード
  const bucketName = process.env.BUCKET_NAME;
  const key = `jobs/${jobId}/data/${index}.csv`;

  await s3Client.send(
    new PutObjectCommand({
      Bucket: bucketName,
      Key: key,
      Body: csvContent,
      ContentType: "text/csv",
    })
  );

  return {
    statusCode: 200,
    jobId,
    index,
    outputLocation: {
      bucket: bucketName,
      key,
    },
  };
};
