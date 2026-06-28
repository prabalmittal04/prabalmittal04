import { mkdirSync, writeFileSync, copyFileSync } from "node:fs";

const USER = process.env.GITHUB_USER || "prabalmittal04";
const TOKEN = process.env.GITHUB_TOKEN;

if (!TOKEN) {
  throw new Error("GITHUB_TOKEN is required");
}

// Calendar year 2026 only — matches GitHub year picker view.
const FROM = "2026-01-01T00:00:00Z";
const TO = new Date().toISOString();

const originalFetch = globalThis.fetch;

function patchFetch(from, to) {
  globalThis.fetch = async (url, options) => {
    if (String(url).includes("api.github.com/graphql")) {
      const body = JSON.parse(options.body);
      return originalFetch(url, {
        ...options,
        body: JSON.stringify({
          query: `
            query ($login: String!, $from: DateTime!, $to: DateTime!) {
              user(login: $login) {
                contributionsCollection(from: $from, to: $to) {
                  contributionCalendar {
                    weeks {
                      contributionDays {
                        contributionCount
                        contributionLevel
                        weekday
                        date
                      }
                    }
                  }
                }
              }
            }
          `,
          variables: { login: body.variables.login, from, to },
        }),
      });
    }
    return originalFetch(url, options);
  };
}

const lightDraw = {
  sizeDotBorderRadius: 2,
  sizeCell: 16,
  sizeDot: 12,
  colorBackground: "#ffffff",
  colorDotBorder: "#1b1f230a",
  colorEmpty: "#ebedf0",
  colorDots: ["#ebedf0", "#9be9a8", "#40c463", "#30a14e", "#216e39"],
  colorSnake: "#8B5CF6",
};

const darkDraw = {
  sizeDotBorderRadius: 2,
  sizeCell: 16,
  sizeDot: 12,
  colorBackground: "#0d1117",
  colorDotBorder: "#1b1f230a",
  colorEmpty: "#161b22",
  colorDots: ["#161b22", "#0e4429", "#006d32", "#26a641", "#39d353"],
  colorSnake: "#8B5CF6",
};

const anim = { frameByStep: 1, stepDurationMs: 100 };

mkdirSync("dist", { recursive: true });

const { generateSnakeAnimation } = await import("generate-snake-animation");

console.log(`Generating 2026 snake from ${FROM.slice(0, 10)} to ${TO.slice(0, 10)}`);
patchFetch(FROM, TO);

const results = await generateSnakeAnimation(
  { platform: "github", username: USER, githubToken: TOKEN },
  [
    {
      filename: "dist/snake-2026.svg",
      format: "svg",
      drawOptions: lightDraw,
      animationOptions: anim,
    },
    {
      filename: "dist/snake-2026-dark.svg",
      format: "svg",
      drawOptions: darkDraw,
      animationOptions: anim,
    },
    {
      filename: "dist/snake-2026.gif",
      format: "gif",
      drawOptions: lightDraw,
      animationOptions: anim,
    },
    {
      filename: "dist/snake-2026-dark.gif",
      format: "gif",
      drawOptions: darkDraw,
      animationOptions: anim,
    },
  ],
);

writeFileSync("dist/snake-2026.svg", results[0]);
writeFileSync("dist/snake-2026-dark.svg", results[1]);
writeFileSync("dist/snake-2026.gif", Buffer.from(results[2]));
writeFileSync("dist/snake-2026-dark.gif", Buffer.from(results[3]));

// Legacy filenames used by older README links
copyFileSync("dist/snake-2026.gif", "dist/github-contribution-grid-snake.gif");
copyFileSync("dist/snake-2026-dark.gif", "dist/github-contribution-grid-snake-dark.gif");
copyFileSync("dist/snake-2026.svg", "dist/github-contribution-grid-snake.svg");
copyFileSync("dist/snake-2026-dark.svg", "dist/github-contribution-grid-snake-dark.svg");

globalThis.fetch = originalFetch;
console.log("Done — 2026 contribution snake GIF generated.");
