import { createTransport } from 'nodemailer'
import { afterEach, describe, expect, it } from 'vitest'
import { type ReceivedMessage, type SmtpListener, startSmtpListener } from './server'

describe('startSmtpListener', () => {
  let listener: SmtpListener | undefined

  afterEach(async () => {
    await listener?.close()
    listener = undefined
  })

  it('accepts a message without auth and reports it', async () => {
    const received: ReceivedMessage[] = []
    listener = await startSmtpListener({
      port: 0,
      host: '127.0.0.1',
      onMessage: (message) => {
        received.push(message)
      },
    })
    expect(listener.port).toBeGreaterThan(0)

    const transport = createTransport({
      host: '127.0.0.1',
      port: listener.port,
      secure: false,
      ignoreTLS: true,
    })
    const info = await transport.sendMail({
      from: 'app@example.test',
      to: ['alice@example.test', 'bob@example.test'],
      subject: 'Spike',
      text: 'hello',
    })
    transport.close()

    expect(info.accepted).toEqual(['alice@example.test', 'bob@example.test'])
    expect(received).toHaveLength(1)
    expect(received[0]?.from).toBe('app@example.test')
    expect(received[0]?.to).toEqual(['alice@example.test', 'bob@example.test'])
    expect(received[0]?.raw.toString('utf8')).toContain('Subject: Spike')
  })

  it('stops accepting connections after close', async () => {
    listener = await startSmtpListener({ port: 0, host: '127.0.0.1', onMessage: () => {} })
    const { port } = listener
    await listener.close()
    listener = undefined

    const transport = createTransport({ host: '127.0.0.1', port, ignoreTLS: true })
    await expect(transport.verify()).rejects.toThrow()
    transport.close()
  })
})
