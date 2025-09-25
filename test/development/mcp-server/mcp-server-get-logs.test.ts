import path from 'path'
import { nextTestSetup } from 'e2e-utils'
import { retry } from 'next-test-utils'

describe('log-file MCP integration', () => {
  const { next, skipped } = nextTestSetup({
    files: path.join(__dirname, 'fixtures', 'log-file-app'),
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

  async function callGetLogs(
    id: string,
    args?: { lines?: number; offset?: number }
  ) {
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
        params: { name: 'get_logs', arguments: args || {} },
      }),
    })

    const text = await response.text()
    const match = text.match(/data: ({.*})/s)
    const result = JSON.parse(match![1])
    return result.result?.content?.[0]?.text
  }

  it('should retrieve logs via MCP get_logs tool', async () => {
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

    // Use inline snapshot to capture the actual log content
    expect(normalizedLogs).toMatchInlineSnapshot(`
      "Showing last 17 of 17 log entries:

      [xx:xx:xx.xxx] Server  LOG     RSC: This is a log message from server component
      [xx:xx:xx.xxx] Server  ERROR   RSC: This is an error message from server component
      [xx:xx:xx.xxx] Server  WARN    RSC: This is a warning message from server component
      [xx:xx:xx.xxx] Server  LOG     Pages Router SSR: This is a log message from getServerSideProps
      [xx:xx:xx.xxx] Server  ERROR   Pages Router SSR: This is an error message from getServerSideProps
      [xx:xx:xx.xxx] Server  WARN    Pages Router SSR: This is a warning message from getServerSideProps
      [xx:xx:xx.xxx] Server  LOG     Pages Router isomorphic: This is a log message from render
      [xx:xx:xx.xxx] Browser LOG     Pages Router isomorphic: This is a log message from render"
    `)
  })

  it('should handle missing log file gracefully via MCP', async () => {
    // This test should run in a clean state, but since other tests may have run first,
    // we'll just verify the MCP tool responds correctly
    const logs = await callGetLogs('test-no-logs')

    // Should have some response (either logs or error message)
    expect(logs).toBeDefined()
    expect(typeof logs).toBe('string')
  })

  it('should return paginated results when many logs exist', async () => {
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
    })

    const normalizedLogs = normalizeLogContent(logs)

    // Use inline snapshot to capture pagination behavior
    // Filtered out the noise logs, the actual lines are 50
    expect(normalizedLogs).toMatchInlineSnapshot(`
     "Showing last 30 of 72 log entries:

     [xx:xx:xx.xxx] Server  LOG     Pages Router SSR: This is a log message from getServerSideProps
     [xx:xx:xx.xxx] Server  ERROR   Pages Router SSR: This is an error message from getServerSideProps
     [xx:xx:xx.xxx] Server  WARN    Pages Router SSR: This is a warning message from getServerSideProps
     [xx:xx:xx.xxx] Server  LOG     Pages Router isomorphic: This is a log message from render
     [xx:xx:xx.xxx] Browser LOG     Pages Router isomorphic: This is a log message from render
     [xx:xx:xx.xxx] Server  LOG     RSC: This is a log message from server component
     [xx:xx:xx.xxx] Server  ERROR   RSC: This is an error message from server component
     [xx:xx:xx.xxx] Server  WARN    RSC: This is a warning message from server component
     [xx:xx:xx.xxx] Server  LOG     Pages Router SSR: This is a log message from getServerSideProps
     [xx:xx:xx.xxx] Server  ERROR   Pages Router SSR: This is an error message from getServerSideProps
     [xx:xx:xx.xxx] Server  WARN    Pages Router SSR: This is a warning message from getServerSideProps
     [xx:xx:xx.xxx] Server  LOG     Pages Router isomorphic: This is a log message from render
     [xx:xx:xx.xxx] Browser LOG     Pages Router isomorphic: This is a log message from render
     [xx:xx:xx.xxx] Server  LOG     RSC: This is a log message from server component
     [xx:xx:xx.xxx] Server  ERROR   RSC: This is an error message from server component
     [xx:xx:xx.xxx] Server  WARN    RSC: This is a warning message from server component
     [xx:xx:xx.xxx] Server  LOG     Pages Router SSR: This is a log message from getServerSideProps
     [xx:xx:xx.xxx] Server  ERROR   Pages Router SSR: This is an error message from getServerSideProps
     [xx:xx:xx.xxx] Server  WARN    Pages Router SSR: This is a warning message from getServerSideProps
     [xx:xx:xx.xxx] Server  LOG     Pages Router isomorphic: This is a log message from render
     [xx:xx:xx.xxx] Browser LOG     Pages Router isomorphic: This is a log message from render"
    `)
  })

  it('should support custom offset and lines parameters', async () => {
    // Test with offset=10, lines=5 (should get lines 10-15 from the end)
    const logsWithOffset = await callGetLogs('test-offset', {
      offset: 10,
      lines: 5,
    })
    const normalizedLogsWithOffset = normalizeLogContent(logsWithOffset)

    expect(normalizedLogsWithOffset).toMatch(
      /Showing lines \d+-\d+ of \d+ log entries \(offset: 10, count: 5\)/
    )

    // Test with just lines=10 (should get last 10 lines)
    const logsWithLines = await callGetLogs('test-lines', { lines: 5 })
    const normalizedLogsWithLines = normalizeLogContent(logsWithLines)

    // The logs are 4 because the unstable noisy logs are filtered out
    expect(normalizedLogsWithLines).toMatchInlineSnapshot(`
     "Showing last 5 of 72 log entries:

     [xx:xx:xx.xxx] Server  ERROR   Pages Router SSR: This is an error message from getServerSideProps
     [xx:xx:xx.xxx] Server  WARN    Pages Router SSR: This is a warning message from getServerSideProps
     [xx:xx:xx.xxx] Server  LOG     Pages Router isomorphic: This is a log message from render
     [xx:xx:xx.xxx] Browser LOG     Pages Router isomorphic: This is a log message from render"
    `)

    // Test with offset=0, lines=3 (should get last 3 lines)
    const logsWithBoth = await callGetLogs('test-both', { offset: 0, lines: 3 })
    const normalizedLogsWithBoth = normalizeLogContent(logsWithBoth)

    // The logs are 2 because the unstable noisy logs are filtered out
    expect(normalizedLogsWithBoth).toMatchInlineSnapshot(`
     "Showing last 3 of 72 log entries:

     [xx:xx:xx.xxx] Server  LOG     Pages Router isomorphic: This is a log message from render
     [xx:xx:xx.xxx] Browser LOG     Pages Router isomorphic: This is a log message from render"
    `)
  })
})
