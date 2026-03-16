const { readFileSync, existsSync, writeFileSync, readdirSync, statSync, mkdirSync } = require("fs");
const { createHash } = require("crypto");
const path = require("path");
const { uploadAsset } = require("./upload");
const { generateTs } = require("./codegen");

/**
 * 拡張子 → Roblox assetType マッピング
 */
const EXT_TO_ASSET_TYPE = {
	// 画像
	".png": "Decal",
	".jpg": "Decal",
	".jpeg": "Decal",
	".bmp": "Decal",
	".tga": "Decal",
	// 音声
	".mp3": "Audio",
	".ogg": "Audio",
	".wav": "Audio",
	".flac": "Audio",
	// 3Dモデル / メッシュ
	".fbx": "Model",
	".glb": "Model",
	".gltf": "Model",
	".obj": "Model",
	// アニメーション
	".rbxm": "Animation",
	".rbxmx": "Animation",
	// 動画
	".mp4": "Video",
	".mov": "Video",
};

/**
 * ファイルの SHA256 ハッシュを計算
 */
function fileHash(filePath) {
	return createHash("sha256").update(readFileSync(filePath)).digest("hex");
}

/**
 * ディレクトリを再帰走査してファイル一覧を返す
 * @returns {{ filePath: string, relPath: string }[]}
 */
function walkDir(dir, base = dir) {
	const results = [];
	if (!existsSync(dir)) return results;
	for (const entry of readdirSync(dir)) {
		if (entry.startsWith(".")) continue;
		const fullPath = path.join(dir, entry);
		if (statSync(fullPath).isDirectory()) {
			results.push(...walkDir(fullPath, base));
		} else {
			results.push({
				filePath: fullPath,
				relPath: path.relative(base, fullPath),
			});
		}
	}
	return results;
}

/**
 * sync セクション 1 つを処理
 * @param {object} syncConfig - { name, path, output, assetType? }
 * @param {{ type: string, id: number }} creator
 * @param {string} apiKey
 * @param {string} cwd
 */
async function syncOne(syncConfig, creator, apiKey, cwd) {
	const assetDir = path.resolve(cwd, syncConfig.path);
	if (!existsSync(assetDir)) {
		console.log(`[${syncConfig.name}] skip: directory not found (${syncConfig.path})`);
		return;
	}

	const lockPath = path.resolve(cwd, `${syncConfig.name}.lock.json`);
	const lock = existsSync(lockPath) ? JSON.parse(readFileSync(lockPath, "utf8")) : {};

	const files = walkDir(assetDir);
	let changed = false;

	for (const { filePath, relPath } of files) {
		const ext = path.extname(filePath).toLowerCase();

		// assetType: 設定で明示指定されていれば優先、なければ拡張子から自動判定
		const assetType = syncConfig.assetType || EXT_TO_ASSET_TYPE[ext];
		if (!assetType) {
			console.log(`[${syncConfig.name}] skip: unsupported extension (${relPath})`);
			continue;
		}

		const key = relPath.replace(/\\/g, "/").replace(/\.[^.]+$/, "");
		const hash = fileHash(filePath);

		if (lock[key]?.hash === hash) {
			console.log(`[${syncConfig.name}] skip: ${relPath} (unchanged)`);
			continue;
		}

		console.log(`[${syncConfig.name}] uploading: ${relPath} ...`);
		const assetId = await uploadAsset(filePath, assetType, apiKey, creator);
		console.log(`[${syncConfig.name}] done: ${relPath} → rbxassetid://${assetId}`);
		lock[key] = { assetId: String(assetId), hash };
		changed = true;
	}

	if (changed || !existsSync(lockPath)) {
		writeFileSync(lockPath, JSON.stringify(lock, null, 2) + "\n");
	}

	// コード生成
	if (syncConfig.output && Object.keys(lock).length > 0) {
		const outputPath = path.resolve(cwd, syncConfig.output);
		const outputDir = path.dirname(outputPath);
		if (!existsSync(outputDir)) mkdirSync(outputDir, { recursive: true });

		const varName = syncConfig.name.replace(/[^a-zA-Z0-9]/g, "_") + "Assets";
		const content = generateTs(lock, varName);
		const existing = existsSync(outputPath) ? readFileSync(outputPath, "utf8") : "";
		if (content !== existing) {
			writeFileSync(outputPath, content);
			console.log(`[${syncConfig.name}] generated: ${syncConfig.output}`);
		}
	}
}

/**
 * 全 sync セクションを順次処理
 */
async function syncAll(config, apiKey, cwd = process.cwd()) {
	for (const syncConfig of config.sync) {
		await syncOne(syncConfig, config.creator, apiKey, cwd);
	}
}

module.exports = { syncAll, syncOne, walkDir, fileHash, EXT_TO_ASSET_TYPE };
