const args = process.argv.slice(2).reduce((acc, next) => {
  const [key, value] = next.split("=");
  acc[key.replace("--", "")] = value;
  return acc;
}, {});

module.exports = {
  url: args.url || "//localhost:2024/sample",
  user: args.user || "tbadmin",
  password: args.password || "",
};