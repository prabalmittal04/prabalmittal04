import { mkdirSync, writeFileSync, copyFileSync } from "node:fs";

const USER = process.env.GITHUB_USER || "prabalmittal04";
const TOKEN = process.env.GITHUB_TOKEN;

if (!TOKEN) {
  throw new Error("GITHUB_TOKEN is required");
}

const RANGES = [
  {
    label: "2025",
    from: "2025-01-01T00:00:00Z",
    to: "2025-12-31T23:59:59Z",
    light: "dist/snake-2025.svg",
    dark: "dist/snake-2025-dark.svg",
  },
  {
    label: "2026",
    from: "2026-01-01T00:00:00Z",
    to: new Date().toISOString(),
    light: "dist/snake-2026.svg",
    dark: "dist/snake-2026-dark.svg",
  },
];

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
  colorBackground: "#0c1116",
  colorDotBorder: "#1b1f230a",
  colorEmpty: "#161b22",
  colorDots: ["#161b22", "#01311f", "#034525", "#0f6d31", "#00c647"],
  colorSnake: "#8B5CF6",
};

const anim = { frameByStep: 1, stepDurationMs: 100 };

mkdirSync("dist", { recursive: true });

const { generateSnakeAnimation } = await import("generate-snake-animation");

for (const range of RANGES) {
  console.log(`Generating snake for ${range.label}`);
  patchFetch(range.from, range.to);

  const results = await generateSnakeAnimation(
    { platform: "github", username: USER, githubToken: TOKEN },
    [
      { filename: range.light, format: "svg", drawOptions: lightDraw, animationOptions: anim },
      { filename: range.dark, format: "svg", drawOptions: darkDraw, animationOptions: anim },
    ],
  );

  writeFileSync(range.light, results[0]);
  writeFileSync(range.dark, results[1]);
  console.log(`Saved ${range.light}`);
}

// Legacy filenames → latest year (2026)
copyFileSync("dist/snake-2026.svg", "dist/github-contribution-grid-snake.svg");
copyFileSync("dist/snake-2026-dark.svg", "dist/github-contribution-grid-snake-dark.svg");

globalThis.fetch = originalFetch;
console.log("Done — 2025 & 2026 snakes generated (no 2024 data).");
