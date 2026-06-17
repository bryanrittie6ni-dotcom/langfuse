import type { NextApiRequest, NextApiResponse } from "next";
import {
  BatchExportFileFormat,
  type BatchExportTableName,
  type FilterState,
  type OrderByState,
  type TracingSearchType,
} from "@langfuse/shared";
import { getServerAuthSession } from "@/src/server/auth";
import { exportData } from "@/src/features/batch-exports/server/exportQuery";
import { z } from "zod";

const bodySchema = z.object({
  projectId: z.string().min(1),
  tableName: z.string().min(1),
  format: z.enum(["CSV", "JSON", "JSONL"]),
  filter: z.array(z.any()).optional().default([]),
  searchQuery: z.string().optional(),
  searchType: z.array(z.string()).optional(),
  orderBy: z.any().optional(),
});

const contentTypeMap: Record<BatchExportFileFormat, string> = {
  CSV: "text/csv; charset=utf-8",
  JSON: "application/json; charset=utf-8",
  JSONL: "application/x-ndjson; charset=utf-8",
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ message: "Method not allowed" });
  }

  const session = await getServerAuthSession({ req, res });
  if (!session?.user) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const parsed = bodySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Invalid input", errors: parsed.error });
  }

  const { projectId, tableName, format, filter, searchQuery, searchType, orderBy } =
    parsed.data;

  const isMember = session.user.organizations
    ?.flatMap((org) => org.projects ?? [])
    ?.some((project) => project.id === projectId);

  if (!isMember) {
    return res.status(403).json({ message: "Forbidden" });
  }

  try {
    const { data, fileName } = await exportData({
      projectId,
      tableName: tableName as BatchExportTableName,
      format: format as BatchExportFileFormat,
      filter: filter as FilterState,
      searchQuery,
      searchType: searchType as TracingSearchType[] | undefined,
      orderBy: orderBy as OrderByState | undefined,
    });

    res.setHeader("Content-Type", contentTypeMap[format as BatchExportFileFormat]);
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${fileName}"; filename*=UTF-8''${encodeURIComponent(fileName)}`,
    );
    res.setHeader("Cache-Control", "no-cache");

    return res.status(200).send(data);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Internal server error";
    if (!res.headersSent) {
      res.status(500).json({ message });
    }
  }
}
