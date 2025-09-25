/**
 * MCP tool for retrieving development logs from the Next.js log file.
 *
 * This tool reads logs from the {nextConfig.distDir}/logs/next-development.log file
 * that contains browser console logs and other development information.
 */
import type { McpServer } from 'next/dist/compiled/@modelcontextprotocol/sdk/server/mcp'
import { readFile, stat } from 'fs/promises'
import { join } from 'path'
import { z } from 'next/dist/compiled/zod'

// Display 30 lines of logs by default
const MAX_LINES = 30

export function registerGetLogsTool(server: McpServer, distDir: string) {
  server.registerTool(
    'get_logs',
    {
      description:
        'Get the development logs from the Next.js log file. Returns browser console logs and other development information.',
      inputSchema: {
        lines: z
          .number()
          .min(1)
          .max(100)
          .optional()
          .describe('Number of lines to return (default: 30)'),
        offset: z
          .number()
          .min(0)
          .optional()
          .describe(
            'Number of lines to skip from the end (default: 0, meaning start from the last lines)'
          ),
      },
    },
    async (request) => {
      try {
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

        // Parse request parameters
        const lines = request.lines || MAX_LINES
        const offset = request.offset || 0

        // Split into lines and filter out empty lines
        const allLines = logContent.split('\n').filter((line) => line.trim())
        const totalLines = allLines.length

        // Calculate the slice range
        // offset=0, lines=10 means: get last 10 lines (slice(-10))
        // offset=10, lines=10 means: get lines 10-20 from the end (slice(-20, -10))
        const startIndex = Math.max(0, totalLines - offset - lines)
        const endIndex = totalLines - offset
        const selectedLines = allLines.slice(startIndex, endIndex)

        const output = selectedLines.join('\n')
        const shownLines = selectedLines.length

        // Generate descriptive text based on the parameters
        let description: string
        if (offset === 0) {
          description = `Showing last ${shownLines} of ${totalLines} log entries`
        } else {
          const startLineNum = startIndex + 1
          const endLineNum = endIndex
          description = `Showing lines ${startLineNum}-${endLineNum} of ${totalLines} log entries (offset: ${offset}, count: ${lines})`
        }

        return {
          content: [
            {
              type: 'text',
              text: `${description}:\n\n${output}`,
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
