// Polls a URL until it answers (used to order Playwright's two webServers).
const url = process.argv[2];
for (let i = 0; i < 300; i++) {
  try {
    await fetch(url);
    process.exit(0);
  } catch {
    await new Promise((r) => setTimeout(r, 1000));
  }
}
console.error(`timed out waiting for ${url}`);
process.exit(1);
