/**
 * Dev helper: verify the SMTP email path end-to-end using a minimal in-process
 * SMTP server (no real credentials needed). Confirms sendEmail routes through
 * nodemailer/SMTP and delivers to the given recipient.
 *
 * Run: node --import tsx scripts/test-smtp-local.ts [recipient]
 */

import * as net from 'node:net';

const recipient = process.argv[2] ?? 'test.patient@example.com';
const PORT = 2525;

interface Message {
  from?: string;
  to?: string[];
  data?: string;
}

/** Minimal SMTP server that accepts a message and records it. */
function startSmtpServer(): Promise<{ messages: Message[] }> {
  // Minimal RFC5321 responder. Uses transpile-safe plain JS to avoid TS types
  // on the socket callbacks.
  const messages: Message[] = [];
  const server = net.createServer((socket) => {
    let from: string | undefined;
    let to: string[] = [];
    let dataMode = false;
    const dataChunks: string[] = [];
    const send = (line: string) => socket.write(line + '\r\n');
    send('220 local ESMTP');
    socket.on('data', (buf) => {
      const lines = buf.toString().split('\r\n');
      for (const raw of lines) {
        if (raw === '') continue;
        if (dataMode) {
          if (raw === '.') {
            messages.push({ from, to, data: dataChunks.join('\n') });
            dataChunks.length = 0;
            dataMode = false;
            send('250 OK');
          } else {
            dataChunks.push(raw);
          }
          continue;
        }
        const line = raw.trim();
        const upper = line.toUpperCase();
        if (upper.startsWith('EHLO') || upper.startsWith('HELO')) {
          send('250-local\r\n250 SIZE 10000000');
        } else if (upper.startsWith('MAIL FROM:')) {
          from = line.slice(10);
          send('250 OK');
        } else if (upper.startsWith('RCPT TO:')) {
          to.push(line.slice(8));
          send('250 OK');
        } else if (upper === 'DATA') {
          dataMode = true;
          send('354 End data with <CR><LF>.<CR><LF>');
        } else if (upper === 'QUIT') {
          send('221 Bye');
          socket.end();
        } else {
          send('250 OK');
        }
      }
    });
  });
  return new Promise((resolve) =>
    server.listen(PORT, '127.0.0.1', () => resolve({ messages } as never)),
  );
}

async function main(): Promise<void> {
  const sink = await startSmtpServer();

  // Provide placeholder values for env keys required by the config schema but
  // not used by the SMTP path (they are not exercised in this test).
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'dummy-anon';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'dummy-service-role';
  process.env.RESEND_API_KEY = 'dummy-resend';

  // Point the env at the local SMTP server (independent of .env.local).
  process.env.SMTP_HOST = '127.0.0.1';
  process.env.SMTP_PORT = String(PORT);
  process.env.SMTP_SECURE = 'false';
  process.env.EMAIL_FROM = 'SwiftLab <lab@swiftlab.test>';
  delete process.env.EMAIL_TEST_TO; // ensure we deliver straight to recipient

  // Load sendEmail AFTER env is set so getServerEnv sees SMTP_HOST.
  const { sendEmail } = await import('../src/lib/email/send');

  const id = await sendEmail({
    to: recipient,
    subject: 'SMTP path test',
    html: '<p>Hello from the SMTP path.</p>',
  });
  console.log('sendEmail returned id:', id);

  const got = (sink as unknown as { messages: { data?: string }[] }).messages;
  const received = got.length;
  console.log('Message received by SMTP sink:', received === 1 ? 'YES' : 'NO');
  if (got[0]) {
    console.log('Subject line present:', got[0].data?.toLowerCase().includes('subject: smtp path test') ? 'YES' : 'NO');
  }
  console.log(received === 1 ? 'SMTP PATH OK' : 'SMTP PATH FAILED');
  process.exit(received === 1 ? 0 : 1);
}

void main();