/**
 * Quick Brevo SMTP credential check. Uses raw SMTP over TLS to isolate the
 * auth error from the app code.
 *
 * Run: node scripts/test-brevo-auth.mjs <login> <smtp-key>
 */
import * as net from "node:net";
import * as tls from "node:tls";

const login = process.argv[2];
const pass = process.argv[3];
if (!login || !pass) {
  console.error(
    "Usage: node scripts/test-brevo-auth.mjs <smtp-login> <smtp-key>",
  );
  process.exit(1);
}

function base64(s) {
  return Buffer.from(s, "utf8").toString("base64");
}

const HOST = "smtp-relay.brevo.com";
const PORT = 587;

function makeClient(host, port) {
  return new Promise((resolve, reject) => {
    const sock = net.connect({ host, port }, () => resolve(sock));
    sock.on("error", reject);
  });
}

function expect(sock, pattern, label) {
  return new Promise((resolve, reject) => {
    let buf = "";
    const timer = setTimeout(
      () => reject(new Error(`TIMEOUT waiting for ${label}`)),
      15000,
    );
    sock.on("data", function onData(d) {
      buf += d.toString();
      if (pattern.test(buf)) {
        clearTimeout(timer);
        sock.removeListener("data", onData);
        resolve(buf);
      }
    });
  });
}

function sendLine(sock, line) {
  console.log("C:", line.split(" ")[0]);
  sock.write(line + "\r\n");
}

async function main() {
  const sock = await makeClient(HOST, PORT);
  const banner = await expect(sock, /^220/, "greeting");
  console.log("S: banner ok");

  sendLine(sock, "EHLO swiftlab.test");
  const ehlo = await expect(sock, /^250[\s-]/, "EHLO");
  console.log("S: EHLO ok, has AUTH =", /AUTH/i.test(ehlo));

  sendLine(sock, "AUTH LOGIN");
  await expect(sock, /^334/, "username prompt");

  sendLine(sock, base64(login));
  await expect(sock, /^334/, "password prompt");

  sendLine(sock, base64(pass));
  // Dump whatever Brevo replies after credentials so we see the real code.
  const resp = await new Promise((resolve, reject) => {
    let buf = "";
    const timer = setTimeout(
      () => reject(new Error("AUTH result timeout")),
      20000,
    );
    sock.on("data", function onData(d) {
      buf += d.toString();
      console.log("RAW:", JSON.stringify(d.toString()));
      if (/^\d{3}[\s-]/.test(buf)) {
        clearTimeout(timer);
        sock.removeListener("data", onData);
        resolve(buf);
      }
    });
  });
  if (/^235/.test(resp)) {
    console.log("AUTH OK — credentials valid");
  } else if (/^535/.test(resp)) {
    console.log("AUTH FAILED — 535 (bad login or key)");
  } else {
    console.log("Unexpected auth response.");
  }

  sendLine(sock, "QUIT");
  sock.end();
  process.exit(0);
}

main().catch((e) => {
  console.error("FATAL:", e.message);
  process.exit(1);
});
