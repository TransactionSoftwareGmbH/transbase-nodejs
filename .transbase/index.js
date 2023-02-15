const path = require("path");

const file = process.platform.startsWith("win")
  ? "tci.dll"
  : process.platform === "darwin"
  ? "libtci.dylib"
  : "libtci.so";

module.exports = {
  include: `"${path.join(__dirname, "include")}"`,
  lib: `"${path.join(__dirname, "lib")}"`,
  bin: `"${path.join(__dirname, "bin", file)}"`,
};
