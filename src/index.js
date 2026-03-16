const { loadEnv, loadConfig } = require("./config");
const { syncAll } = require("./sync");
const { uploadAsset } = require("./upload");
const { generateTs } = require("./codegen");
const { EXT_TO_ASSET_TYPE } = require("./sync");

module.exports = { loadEnv, loadConfig, syncAll, uploadAsset, generateTs, EXT_TO_ASSET_TYPE };
