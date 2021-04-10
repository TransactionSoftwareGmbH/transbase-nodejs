const args = require("minimist")(process.argv.slice(2));
module.exports = {
  url: args.H || args.url || "//localhost:2024/sample",
  user: args.U || args.user || "tbadmin",
  password: args.P || args.password || "",
};
