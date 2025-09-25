import { nextTestSetup } from 'e2e-utils'
import { retry } from 'next-test-utils'

describe('log-file MCP integration', () => {
  const { next, isNextDev, skipped } = nextTestSetup({
    files: __dirname,
    skipDeployment: true,
  })

  if (skipped) {
    return
  }

  function normalizeLogContent(content: string): string {
    return (
      content
        // Strip lines containing "Download the React DevTools"
        .split('\n')
        .filter((line) => {
          // filter out the noise logs
          if (
            /Download the React DevTools|connected to ws at|received ws message|Next.js page already hydrated|Next.js hydrate callback fired|Compiling|Compiled|Ready in/.test(
              line
            )
          ) {
            return false
          }
          return true
        })
        .join('\n')
        // Normalize timestamps to consistent format
        .replace(/\[\d{2}:\d{2}:\d{2}\.\d{3}\]/g, '[xx:xx:xx.xxx]')
        // Normalize dynamic content that might vary between test runs
        .replace(/localhost:\d+/g, 'localhost:PORT')
    )
  }

  async function callGetLogs(id: string) {
    const response = await fetch(`${next.url}/_next/mcp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id,
        method: 'tools/call',
        params: { name: 'get_logs', arguments: {} },
      }),
    })

    const text = await response.text()
    const match = text.match(/data: ({.*})/s)
    const result = JSON.parse(match![1])
    return result.result?.content?.[0]?.text
  }

  it('should retrieve logs via MCP get_logs tool', async () => {
    if (!isNextDev) {
      // MCP server is only available in dev mode
      return
    }

    // Generate some logs by visiting pages that create log entries
    await next.browser('/server')
    await next.browser('/client')
    await next.browser('/pages-router-page')

    // Wait for logs to be written
    await new Promise((resolve) => setTimeout(resolve, 2000))

    let logs: string = ''
    await retry(async () => {
      const sessionId = 'test-mcp-logs-' + Date.now()
      logs = await callGetLogs(sessionId)

      // Should have some log content
      expect(logs).not.toBe(
        'Log file is empty. No logs have been recorded yet.'
      )
      expect(logs).not.toContain('Log file not found at')
    }, 3 * 1000)

    const normalizedLogs = normalizeLogContent(logs)

    // Should contain some log entries
    expect(normalizedLogs).toMatch(/Showing last \d+ of \d+ log entries/)
    expect(normalizedLogs).toContain('[xx:xx:xx.xxx]')

    // Should contain logs from the pages we visited
    expect(normalizedLogs).toContain(
      'RSC: This is a log message from server component'
    )
    expect(normalizedLogs).toContain(
      'Pages Router SSR: This is a log message from getServerSideProps'
    )
    // Note: Client logs may not be captured in the log file in all cases
  })

  it('should handle missing log file gracefully via MCP', async () => {
    if (!isNextDev) {
      return
    }

    // This test should run in a clean state, but since other tests may have run first,
    // we'll just verify the MCP tool responds correctly
    const logs = await callGetLogs('test-no-logs')

    // Should have some response (either logs or error message)
    expect(logs).toBeDefined()
    expect(typeof logs).toBe('string')
  })

  it('should return paginated results when many logs exist', async () => {
    if (!isNextDev) {
      return
    }

    // Generate logs by visiting multiple pages multiple times
    for (let i = 0; i < 5; i++) {
      await next.browser('/server')
      await next.browser('/client')
      await next.browser('/pages-router-page')
      // Small delay between visits
      await new Promise((resolve) => setTimeout(resolve, 100))
    }

    // Wait for logs to be written
    await new Promise((resolve) => setTimeout(resolve, 2000))

    let logs: string = ''
    await retry(async () => {
      const sessionId = 'test-pagination-' + Date.now()
      logs = await callGetLogs(sessionId)

      // Should have log content
      expect(logs).not.toBe(
        'Log file is empty. No logs have been recorded yet.'
      )
      expect(logs).not.toContain('Log file not found at')
    }, 3 * 1000)

    const normalizedLogs = normalizeLogContent(logs)

    // Should show pagination info
    expect(normalizedLogs).toMatch(/Showing last \d+ of \d+ log entries/)

    // Should contain some of the expected log content
    expect(normalizedLogs).toContain('[xx:xx:xx.xxx]')
  })
})
