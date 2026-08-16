const path = require("node:path");
const { getDefaultConfig } = require("expo/metro-config");

/**
 * Metro is pointed at the web app's source tree so the phone app can import the
 * planning logic rather than reimplement it.
 *
 * `src/lib/domain/` is pure TypeScript with no database, Next.js or Node
 * imports — that was a deliberate rule from the first commit, and this is the
 * payoff. Timeline generation, budget rollups and RSVP counts run identically
 * on the server, in the browser and on the phone, from one file each. Copying
 * them would guarantee three answers to "how many days until the wedding".
 *
 * Two things are required to reach outside the project root:
 *  - `watchFolders`, or Metro will not see edits to shared files;
 *  - `nodeModulesPaths`, or those files resolve their own imports against a
 *    directory that does not exist beside them.
 */
const projectRoot = __dirname;
const repoRoot = path.resolve(projectRoot, "..");

const config = getDefaultConfig(projectRoot);

config.watchFolders = [path.join(repoRoot, "src")];

config.resolver.nodeModulesPaths = [
  path.join(projectRoot, "node_modules"),
  path.join(repoRoot, "node_modules"),
];

// The shared files import each other as `@/lib/...`, matching the web app's
// tsconfig paths. Mapping the same alias here means they need no edits to be
// bundled for the phone — the sharing stays invisible to the code being shared.
config.resolver.alias = {
  ...config.resolver.alias,
  "@": path.join(repoRoot, "src"),
};

module.exports = config;
