import "dotenv/config";
import { prisma } from "@/lib/db";
import { mintUnlockCode } from "@/lib/services/plan";

/**
 * Mints Pro unlock codes from the command line.
 *
 * There is no payment provider yet, so this is how a code comes into existence:
 * someone runs it and sends the result to a couple. When a provider is wired up
 * its webhook calls `mintUnlockCode` instead and this script stays useful for
 * comps, support and testing.
 *
 *   npm run plan:mint-code -- --count 3 --label "launch batch"
 *
 * The code is printed once. Only its hash is stored, so a lost code is reissued,
 * never recovered.
 */

/**
 * Reads `--name value`, taking every word up to the next flag.
 *
 * Multi-word values matter here: npm strips the quotes from
 * `-- --label "launch batch"`, so a naive `argv[index + 1]` silently records the
 * label as "launch".
 */
function flag(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  if (index === -1) return undefined;

  const words: string[] = [];
  for (let at = index + 1; at < process.argv.length; at += 1) {
    if (process.argv[at].startsWith("--")) break;
    words.push(process.argv[at]);
  }
  return words.length > 0 ? words.join(" ") : undefined;
}

async function main() {
  const count = Number.parseInt(flag("count") ?? "1", 10);
  if (!Number.isInteger(count) || count < 1 || count > 100) {
    throw new Error("--count must be a whole number between 1 and 100.");
  }

  const label = flag("label");

  const codes: string[] = [];
  for (let index = 0; index < count; index += 1) {
    codes.push(await mintUnlockCode(label));
  }

  console.log(
    `\nMinted ${count} unlock ${count === 1 ? "code" : "codes"}${
      label ? ` (${label})` : ""
    }:\n`,
  );
  for (const code of codes) console.log(`  ${code}`);
  console.log(
    "\nEach unlocks Pro for one wedding, once. Shown here and nowhere else —\nonly the hash is stored.\n",
  );
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
