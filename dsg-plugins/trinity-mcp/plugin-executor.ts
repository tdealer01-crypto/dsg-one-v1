/**
 * Trinity MCP Plugin Executor
 * Secure, sandboxed plugin execution with VM2 + cost tracking
 */

import { VM } from 'vm2';
import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';

interface ExecutionContext {
  pluginId: string;
  userId: string;
  timeout?: number;
  costBudget?: number;
}

interface ExecutionResult {
  executionId: string;
  status: 'success' | 'failed' | 'error';
  result?: unknown;
  errorMessage?: string;
  executionTimeMs: number;
  costUsd: number;
}

interface PluginMetadata {
  name: string;
  code: string;
  rsaSignature: string;
  costUsd: number;
  costMaxUsd: number;
}

const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || '',
);

/**
 * Verify plugin RSA signature
 * Ensures plugin code hasn't been tampered with
 */
function verifyPluginSignature(code: string, signature: string): boolean {
  try {
    const publicKey = process.env.PLUGIN_PUBLIC_KEY;
    if (!publicKey) {
      console.warn('PLUGIN_PUBLIC_KEY not set, skipping signature verification');
      return true;
    }

    const verifier = crypto.createVerify('sha256');
    verifier.update(code);
    return verifier.verify(publicKey, Buffer.from(signature, 'hex'));
  } catch (err) {
    console.error('Signature verification error:', err);
    return false;
  }
}

/**
 * Calculate execution cost based on time and resource usage
 * Base: $0.01, Max: $1.00
 */
function calculateCost(executionTimeMs: number, maxCost: number = 1.0): number {
  // Base cost $0.01 + $0.001 per 100ms of execution
  const timeCost = (executionTimeMs / 100) * 0.001;
  const totalCost = Math.max(0.01, Math.min(0.01 + timeCost, maxCost));
  return parseFloat(totalCost.toFixed(4));
}

/**
 * Create sandboxed VM2 context
 * Restricts access to dangerous APIs
 */
function createSandboxContext() {
  return {
    // Safe built-ins
    console: {
      log: console.log,
      error: console.error,
      warn: console.warn,
    },
    Math,
    Date,
    JSON,
    Array,
    Object,
    String,
    Number,
    Boolean,
    // Plugin I/O utilities
    input: null as unknown,
    output: null as unknown,
    // Prevent dangerous access
    require: undefined,
    process: undefined,
    global: undefined,
    Buffer: undefined,
    fetch: undefined,
    eval: undefined,
  };
}

/**
 * Execute plugin in sandboxed VM2 environment
 */
export async function executePlugin(
  pluginMetadata: PluginMetadata,
  input: unknown,
  context: ExecutionContext,
): Promise<ExecutionResult> {
  const startTime = Date.now();
  const executionId = crypto.randomUUID();

  try {
    // 1. Verify plugin signature
    if (!verifyPluginSignature(pluginMetadata.code, pluginMetadata.rsaSignature)) {
      throw new Error('Plugin signature verification failed');
    }

    // 2. Create sandbox context
    const sandboxContext = createSandboxContext();
    sandboxContext.input = input;

    // 3. Execute in VM2 sandbox
    const vm = new VM({
      timeout: context.timeout || 30000,
      sandbox: sandboxContext,
    });

    const result = vm.run(`
      (function() {
        ${pluginMetadata.code}
      })()
    `);

    const executionTimeMs = Date.now() - startTime;
    const costUsd = calculateCost(executionTimeMs, pluginMetadata.costMaxUsd);

    // 4. Log execution to database
    const { data, error } = await supabase
      .from('executions')
      .insert([
        {
          id: executionId,
          plugin_id: pluginMetadata.name,
          user_id: context.userId,
          cost_usd: costUsd,
          status: 'success',
          result: JSON.stringify(result),
          execution_time_ms: executionTimeMs,
          completed_at: new Date().toISOString(),
        },
      ])
      .select();

    if (error) {
      console.error('Database error:', error);
      return {
        executionId,
        status: 'error',
        errorMessage: `Database error: ${error.message}`,
        executionTimeMs,
        costUsd,
      };
    }

    return {
      executionId,
      status: 'success',
      result,
      executionTimeMs,
      costUsd,
    };
  } catch (err) {
    const executionTimeMs = Date.now() - startTime;
    const costUsd = calculateCost(executionTimeMs, pluginMetadata.costMaxUsd);

    const errorMessage = err instanceof Error ? err.message : String(err);

    // Log failed execution
    await supabase
      .from('executions')
      .insert([
        {
          id: executionId,
          plugin_id: pluginMetadata.name,
          user_id: context.userId,
          cost_usd: costUsd,
          status: 'error',
          error_message: errorMessage,
          execution_time_ms: executionTimeMs,
          completed_at: new Date().toISOString(),
        },
      ])
      .select();

    return {
      executionId,
      status: 'error',
      errorMessage,
      executionTimeMs,
      costUsd,
    };
  }
}

/**
 * Validate plugin code for banned APIs
 * Prevents malicious operations
 */
export function validatePluginCode(code: string): { valid: boolean; errors: string[] } {
  const bannedPatterns = [
    /require\s*\(/,
    /eval\s*\(/,
    /Function\s*\(/,
    /child_process/,
    /fs\./,
    /\.rmdir/,
    /\.unlink/,
    /process\./,
    /global\./,
    /window\./,
    /document\./,
    /XMLHttpRequest/,
  ];

  const errors: string[] = [];

  for (const pattern of bannedPatterns) {
    if (pattern.test(code)) {
      errors.push(`Banned API detected: ${pattern.source}`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Register as Trinity MCP server
 * Exposes execute-plugin and validate-plugin tools
 */
export async function registerMcpTools() {
  return {
    'execute-plugin': {
      description: 'Execute a plugin in sandboxed VM2 environment',
      inputSchema: {
        type: 'object',
        properties: {
          pluginId: { type: 'string', description: 'Plugin UUID' },
          userId: { type: 'string', description: 'User UUID' },
          input: { type: 'object', description: 'Plugin input data' },
        },
        required: ['pluginId', 'userId'],
      },
    },
    'validate-plugin': {
      description: 'Validate plugin code for banned APIs',
      inputSchema: {
        type: 'object',
        properties: {
          code: { type: 'string', description: 'Plugin code to validate' },
        },
        required: ['code'],
      },
    },
  };
}

/**
 * Handle tool invocation from MCP
 */
export async function handleToolCall(
  toolName: string,
  args: Record<string, unknown>,
): Promise<unknown> {
  if (toolName === 'validate-plugin') {
    const code = args.code as string;
    return validatePluginCode(code);
  }

  if (toolName === 'execute-plugin') {
    const pluginId = args.pluginId as string;
    const userId = args.userId as string;
    const input = args.input;

    // Fetch plugin metadata from database
    const { data: plugin, error } = await supabase
      .from('plugins')
      .select('*')
      .eq('id', pluginId)
      .single();

    if (error || !plugin) {
      return { error: 'Plugin not found' };
    }

    return executePlugin(plugin, input, {
      pluginId,
      userId,
    });
  }

  return { error: 'Unknown tool' };
}
