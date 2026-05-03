import type { AppBuilderJob } from './model';
import { executeApprovedAppBuilderJob, type AppBuilderRuntimeExecutionResult } from './action-runtime';
import { createAppBuilderRuntimeHandoff } from './runtime-handoff';

export type AppBuilderToolRisk = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export type AppBuilderToolDefinition = {
  name: string;
  description: string;
  riskLevel: AppBuilderToolRisk;
  requiresApproval: boolean;
  requiredAllowedTools: string[];
  parameters: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
    additionalProperties: boolean;
  };
};

export type AppBuilderToolCallInput = {
  toolName: string;
  arguments?: Record<string, unknown>;
};

export type AppBuilderToolCallResult = {
  toolName: string;
  status: 'EXECUTED';
  claimStatus: 'IMPLEMENTED_UNVERIFIED';
  riskLevel: AppBuilderToolRisk;
  output: AppBuilderRuntimeExecutionResult;
  evidence: {
    approvalChecked: boolean;
    planHashChecked: boolean;
    allowedToolChecked: boolean;
    note: string;
  };
};

export const APP_BUILDER_BUILD_TOOL_NAME = 'dsg.app_builder.generate_fullstack_pr';

export const appBuilderBuildTools: AppBuilderToolDefinition[] = [
  {
    name: APP_BUILDER_BUILD_TOOL_NAME,
    description: 'Generate a database-backed full-stack Next.js app from an approved DSG App Builder plan, write files to a GitHub branch, and open a pull request as implementation evidence.',
    riskLevel: 'HIGH',
    requiresApproval: true,
    requiredAllowedTools: ['file.write'],
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        mode: {
          type: 'string',
          enum: ['github_pr'],
          description: 'Only github_pr is supported. The tool writes implementation files to a GitHub branch and creates a PR.',
        },
      },
      required: ['mode'],
    },
  },
];

export function listAppBuilderBuildTools(): AppBuilderToolDefinition[] {
  return appBuilderBuildTools;
}

function findTool(name: string): AppBuilderToolDefinition {
  const tool = appBuilderBuildTools.find((item) => item.name === name);
  if (!tool) throw new Error(`APP_BUILDER_TOOL_NOT_FOUND:${name}`);
  return tool;
}

function assertApprovedToolCall(job: AppBuilderJob, tool: AppBuilderToolDefinition, args: Record<string, unknown>) {
  if (tool.requiresApproval && job.status !== 'READY_FOR_RUNTIME') throw new Error('APP_BUILDER_TOOL_APPROVAL_REQUIRED');
  if (!job.approvedPlan) throw new Error('APP_BUILDER_APPROVED_PLAN_REQUIRED');
  if (args.mode !== 'github_pr') throw new Error('APP_BUILDER_TOOL_MODE_UNSUPPORTED');

  const handoff = createAppBuilderRuntimeHandoff(job);
  for (const requiredTool of tool.requiredAllowedTools) {
    if (!handoff.allowedTools.includes(requiredTool)) {
      throw new Error(`APP_BUILDER_TOOL_PERMISSION_MISSING:${requiredTool}`);
    }
  }
}

export async function callAppBuilderBuildTool(job: AppBuilderJob, input: AppBuilderToolCallInput): Promise<AppBuilderToolCallResult> {
  const tool = findTool(input.toolName);
  const args = input.arguments ?? {};
  assertApprovedToolCall(job, tool, args);

  if (tool.name !== APP_BUILDER_BUILD_TOOL_NAME) throw new Error('APP_BUILDER_TOOL_UNSUPPORTED');

  const output = await executeApprovedAppBuilderJob(job);
  return {
    toolName: tool.name,
    status: 'EXECUTED',
    claimStatus: 'IMPLEMENTED_UNVERIFIED',
    riskLevel: tool.riskLevel,
    output,
    evidence: {
      approvalChecked: true,
      planHashChecked: true,
      allowedToolChecked: true,
      note: 'The build tool executed only after READY_FOR_RUNTIME approval and runtime handoff verification. It creates implementation evidence, not deployment or production proof.',
    },
  };
}
