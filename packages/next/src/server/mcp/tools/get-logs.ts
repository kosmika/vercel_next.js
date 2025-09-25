/**
 * MCP tool for retrieving development logs from the Next.js log file.
 *
 * This tool reads logs from the {nextConfig.distDir}/logs/next-development.log file
 * that contains browser console logs and other development information.
 */
import type { McpServer } from 'next/dist/compiled/@modelcontextprotocol/sdk/server/mcp'
import { readFile, stat } from 'fs/promises'
import { join } from 'path'

export function registerGetLogsTool(server: McpServer, distDir: string) {
  server.registerTool(
    'get_logs',
    {
      description:
        'Get the development logs from the Next.js log file. Returns browser console logs and other development information.',
      inputSchema: {},
    },
    async (_request) => {
      try {
        const lines = 100 // Default to 100 lines, can be made configurable in the future
        const logFilePath = join(distDir, 'logs', 'next-development.log')

        // Check if the log file exists
        try {
          await stat(logFilePath)
        } catch (error) {
          return {
            content: [
              {
                type: 'text',
                text: `Log file not found at ${logFilePath}. Make sure the MCP server is enabled and the development server is running.`,
              },
            ],
          }
        }

        // Read the log file
        const logContent = await readFile(logFilePath, 'utf-8')

        // Check if file has any non-whitespace content
        const hasContent = logContent.split('\n').some((line) => line.trim())

        if (!hasContent) {
          return {
            content: [
              {
                type: 'text',
                text: 'Log file is empty. No logs have been recorded yet.',
              },
            ],
          }
        }

        // Split into lines and get the last N lines
        const allLines = logContent.split('\n').filter((line) => line.trim())
        const lastLines = allLines.slice(-lines)

        if (lastLines.length === 0) {
          return {
            content: [
              {
                type: 'text',
                text: 'No log entries found in the file.',
              },
            ],
          }
        }

        const output = lastLines.join('\n')
        const totalLines = allLines.length
        const shownLines = lastLines.length

        return {
          content: [
            {
              type: 'text',
              text: `Showing last ${shownLines} of ${totalLines} log entries:\n\n${output}`,
            },
          ],
        }
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error reading logs: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
        }
      }
    }
  )
}
