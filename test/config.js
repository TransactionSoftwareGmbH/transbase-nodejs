const args = require("minimist")(process.argv.slice(2));
module.exports = {
  url: args.url || "//localhost:2024/sample",
  user: args.user || "tbadmin",
  password: args.password || "",
};