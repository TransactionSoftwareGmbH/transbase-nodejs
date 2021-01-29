const fs = require("fs");
const transbasePath = process.env.TRANSBASE;
if (transbasePath && fs.existsSync(transbasePath)) {
  console.log("Found Transbase in path, skipping download");
  process.exit(0);
}

const path = require("path");
const request = require("request");
const zlib = require("zlib");
const tar = require("tar");

const version = require("../package.json").transbaseVersion;

const os = (function getPlatform() {
  const arch = process.arch;
  switch (process.platform) {
    case "win32":
      return { platform: "windows", arch };
    case "linux":
      return { platform: "linux", arch };
    case "darwin":
      return { platform: "macos", arch };
    default:
      throw new Error(
        "Operation System " +
          process.platform +
          " is not supported. Contact develop@transaction.de for more support"
      );
  }
})();

const downloadUrl = `https://www.transaction.de/transbase/${version}/${os.platform}_${os.arch}/sdk/transbase-${version}_${os.platform}-${os.arch}_sdk.tgz`;

const outDir = "./build/tci_sdk";
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir);
}

request(downloadUrl)
  .on("error", console.log)
  .pipe(zlib.Unzip())
  .pipe(
    tar.x({
      C: outDir,
    })
  );

process.env.TRANSBASE = path.join(__dirname, "../build/tci_sdk");
