"use strict";

const fs = require("fs");
const path = require("path");
const request = require("request");
const zlib = require("zlib");
const tar = require("tar");

const outDir = "./.transbase/tci_sdk";
const version = require("../package.json").transbaseVersion;
const downloadUrl = (os = getPlatform()) =>
  `https://www.transaction.de/transbase/${version}/${os.platform}_${os.arch}/sdk/transbase-${version}_${os.platform}-${os.arch}_sdk.tgz`;

const log = (message, args = "") => console.log("prerebuild: " + message, args);

function checkSdkDownload() {
  // skip download if matching transbase version is found locally in path
  const transbasePath = process.env.TRANSBASE;
  if (transbasePath && fs.existsSync(transbasePath)) {
    if (checkVersion(transbasePath, { exact: false })) {
      log("Found Transbase in path, skipping download");
      return false;
    } else {
      log("Local Transbase version does not match:", version);
    }
  }
  // skip if already downloaded
  if (fs.existsSync(path.join(outDir, "include", "tci.h"))) {
    if (checkVersion(outDir)) {
      log("tci sdk is up-to-date, skipping download");
      return false;
    }
  }
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }
}

function checkVersion(dir, { exact = true } = {}) {
  const tci_h = fs
    .readFileSync(path.join(dir, "include", "tci.h"))
    .toString("utf-8", 0, 300);
  const [, major, minor, patch] = tci_h.match(
    /tci.h:   V([0-9]+).([0-9]+).([0-9]+).*/
  );
  return exact
    ? version === `${major}.${minor}.${patch}`
    : version.startsWith(`${major}.${minor}`);
}

function getPlatform() {
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
}

if (checkSdkDownload()) {
  log("download tci sdk from:", downloadUrl());
  request(downloadUrl())
    .on("error", console.error)
    .pipe(zlib.Unzip())
    .pipe(tar.x({ C: outDir }));
}

process.env.TRANSBASE = path.resolve(outDir);
