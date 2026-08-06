const { chromium } = require("playwright");
const path = require("path");

const outDir = process.argv[2];
const port = process.argv[3];
const demoPassword = process.argv[4] || "MarketingDemo123!";
const screens = {
  "01-create-vault.png": "create",
  "02-vault-overview.png": "vault",
  "03-entry-dialog.png": "entry",
  "04-documents.png": "documents",
  "05-settings-security.png": "settings",
  "06-architecture.png": "architecture",
};

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  for (const [file, screen] of Object.entries(screens)) {
    const url =
      screen === "create"
        ? `http://localhost:${port}/marketing.html?screen=${screen}&demoPassword=${encodeURIComponent(demoPassword)}`
        : `http://localhost:${port}/marketing.html?screen=${screen}`;
    await page.goto(url, { waitUntil: "networkidle" });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: path.join(outDir, file), fullPage: false });
    console.log("Captured", file);
  }
  await browser.close();
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
