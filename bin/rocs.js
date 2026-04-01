#!/usr/bin/env node

const { loadEnv, loadConfig } = require("../src/config");
const { syncAll } = require("../src/sync");
const { watchAll } = require("../src/watch");

const HELP = `
rocs - Roblox Open Cloud Asset Sync

Usage:
  rocs sync       Sync all assets defined in rocs.toml
  rocs watch      Watch for file changes and sync automatically
  rocs help       Show this help message

Options (watch):
  --debounce <ms> Debounce interval in ms (default: 10000)

Environment:
  ROCS_API_KEY    Roblox Open Cloud API key (or set in .env)
`;

async function main() {
	const command = process.argv[2];

	if (!command || command === "help" || command === "--help" || command === "-h") {
		console.log(HELP.trim());
		process.exit(0);
	}

	if (command !== "sync" && command !== "watch") {
		console.error(`Unknown command: ${command}`);
		console.log(HELP.trim());
		process.exit(1);
	}

	loadEnv();

	const apiKey = process.env.ROCS_API_KEY;
	if (!apiKey) {
		console.error("API key not found. Set ROCS_API_KEY in .env or environment.");
		process.exit(1);
	}

	const config = loadConfig();

	if (command === "watch") {
		let debounce;
		const debounceIdx = process.argv.indexOf("--debounce");
		if (debounceIdx !== -1 && process.argv[debounceIdx + 1]) {
			debounce = parseInt(process.argv[debounceIdx + 1], 10);
		}
		watchAll(config, apiKey, { debounce });
		return;
	}

	console.log(`Syncing ${config.sync.length} asset group(s)...`);
	await syncAll(config, apiKey);
	console.log("Done.");
}

main().catch((e) => {
	console.error(e.message);
	process.exit(1);
});
