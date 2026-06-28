import { mkdirSync, writeFileSync } from "node:fs";

const USER = process.env.GITHUB_USER || "prabalmittal04";
const TOKEN = process.env.GITHUB_TOKEN;

if (!TOKEN) {
  throw new Error("GITHUB_TOKEN is required");
}

// Match GitHub profile: rolling last 365 days (excludes 2024 for this account).
const now = new Date();
const fromDate = new Date(now);
fromDate.setUTCDate(fromDate.getUTCDate() - 364);
fromDate.setUTCHours(0, 0, 0, 0);

const FROM = fromDate.toISOString();
const TO = now.toISOString();

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
  colorDots: ["#161b22", "#01311f", "#034525", "#0f6d31", "#00c647"],
  colorSnake: "#8B5CF6",
};

const anim = { frameByStep: 1, stepDurationMs: 100 };

mkdirSync("dist", { recursive: true });

const { generateSnakeAnimation } = await import("generate-snake-animation");

console.log(`Generating snake from ${FROM.slice(0, 10)} to ${TO.slice(0, 10)}`);
patchFetch(FROM, TO);

const results = await generateSnakeAnimation(
  { platform: "github", username: USER, githubToken: TOKEN },
  [
    {
      filename: "dist/github-contribution-grid-snake.svg",
      format: "svg",
      drawOptions: lightDraw,
      animationOptions: anim,
    },
    {
      filename: "dist/github-contribution-grid-snake-dark.svg",
      format: "svg",
      drawOptions: darkDraw,
      animationOptions: anim,
    },
    {
      filename: "dist/github-contribution-grid-snake.gif",
      format: "gif",
      drawOptions: darkDraw,
      animationOptions: anim,
    },
  ],
);

writeFileSync("dist/github-contribution-grid-snake.svg", results[0]);
writeFileSync("dist/github-contribution-grid-snake-dark.svg", results[1]);
writeFileSync("dist/github-contribution-grid-snake.gif", Buffer.from(results[2]));

globalThis.fetch = originalFetch;
console.log("Done — rolling 365-day snake GIF + SVG generated.");
