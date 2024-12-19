import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { Context } from "aws-lambda";

const s3Client = new S3Client({});

interface GenerateDataEvent {
  jobId?: string;
}

export const handler = async (event: GenerateDataEvent, _context: Context) => {
  const jobId = event.jobId || new Date().getTime().toString();
  const fileCount = 100;
  const results = [];

  // 100個のファイルを生成
  for (let index = 0; index < fileCount; index++) {
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

    results.push({
      index,
      location: {
        bucket: bucketName,
        key,
      },
    });
  }

  return {
    statusCode: 200,
    jobId,
    items: results,
  };
};
