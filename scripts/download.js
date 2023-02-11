"use strict";

const fs = require("fs");
const path = require("path");
const request = require("request");
const zlib = require("zlib");
const tar = require("tar");

const outDir = process.env.PWD + "/.transbase";
const version = require("../package.json").transbaseVersion;
const [major, minor, _] = version.split(".");

const downloadUrl = (os = getPlatform()) =>
  `https://www.transaction.de/downloads/transbase/${major}.${minor}/${os.platform}/${os.arch}/transbase_dev.tar.Z`;

function checkSdkDownload() {
  // skip if already downloaded
  if (fs.existsSync(path.join(outDir, "include", "tci.h"))) {
    if (checkVersion(outDir)) {
      console.log("tci sdk is up-to-date, skipping download");
      return false;
    }
  }
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }
  return true;
}

function checkVersion(dir) {
  const tci_h = fs
    .readFileSync(path.join(dir, "include", "tci.h"))
    .toString("utf-8", 0, 300);
  const [, major, minor, patch] = tci_h.match(
    /tci.h:   V([0-9]+).([0-9]+).([0-9]+).*/
  );
  return version === `${major}.${minor}.${patch}`;
}

function getPlatform() {
  const arch = process.arch === "x64" ? "x86_64" : "x86";
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
  console.log("download tci sdk from:", downloadUrl());
  request(downloadUrl())
    .on("error", console.error)
    .pipe(zlib.Unzip())
    .pipe(
      tar.extract({
        cwd: outDir,
        filter: (path) => path.includes("tci"),
      })
    );
}
