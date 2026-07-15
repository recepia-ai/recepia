"use server";

import { z } from "zod";
import { getAdminClinicId } from "@/app/(app)/settings/test-availability/_actions/test-helpers";
import { getTool } from "@/lib/agent/tools/registry";
import { invokeTool, buildToolContext } from "@/lib/agent/tools/invoke-tool";

// ---------------------------------------------------------------------------
// Test tool invocation (admin-only server action)
// ---------------------------------------------------------------------------

export type ToolTestResult = {
  success: boolean;
  tool_name: string;
  input: unknown;
  output?: unknown;
  error?: string;
  error_code?: string;
  validation_error?: string;
};

export async function testInvokeTool(
  toolName: string,
  inputJson: string,
): Promise<ToolTestResult> {
  // Admin guard
  const clinicIdOrError = await getAdminClinicId();
  if (typeof clinicIdOrError !== "string") {
    return {
      success: false,
      tool_name: toolName,
      input: inputJson,
      error: clinicIdOrError.error,
    };
  }

  // Look up tool
  const tool = getTool(toolName);
  if (!tool) {
    return {
      success: false,
      tool_name: toolName,
      input: inputJson,
      error: `Tool "${toolName}" no encontrada.`,
    };
  }

  // Parse input JSON
  let parsed: unknown;
  try {
    parsed = JSON.parse(inputJson);
  } catch {
    return {
      success: false,
      tool_name: toolName,
      input: inputJson,
      error: "El input JSON no es válido.",
    };
  }

  // Validate with Zod
  const validation = tool.inputSchema.safeParse(parsed);
  if (!validation.success) {
    return {
      success: false,
      tool_name: toolName,
      input: parsed,
      validation_error:
        validation.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "),
    };
  }

  // Build context and invoke
  const ctx = buildToolContext(clinicIdOrError, null);

  const result = await invokeTool(tool, validation.data, ctx);

  if (!result.success) {
    return {
      success: false,
      tool_name: toolName,
      input: validation.data,
      error: result.error,
      error_code: result.error_code,
    };
  }

  return {
    success: true,
    tool_name: toolName,
    input: validation.data,
    output: result.data,
  };
}
