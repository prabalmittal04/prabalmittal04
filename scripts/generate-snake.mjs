import { mkdirSync, writeFileSync, copyFileSync } from "node:fs";

const USER = process.env.GITHUB_USER || "prabalmittal04";
const TOKEN = process.env.CONTRIB_PAT || process.env.GITHUB_TOKEN;

if (!TOKEN) {
  throw new Error("GITHUB_TOKEN or CONTRIB_PAT is required");
}

// Same window as GitHub profile: "contributions in the last year" (Jul → Jun layout).
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
      return originalFetch(url, {
        ...options,
        headers: {
          ...options.headers,
          Authorization: `Bearer ${TOKEN}`,
        },
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
          variables: { login: USER, from, to },
        }),
      });
    }
    return originalFetch(url, options);
  };
}

// GitHub default light palette — matches profile contribution graph colors.
const lightDraw = {
  sizeDotBorderRadius: 2,
  sizeCell: 14,
  sizeDot: 10,
  colorBackground: "#ffffff",
  colorDotBorder: "#1b1f230a",
  colorEmpty: "#ebedf0",
  colorDots: ["#ebedf0", "#9be9a8", "#40c463", "#30a14e", "#216e39"],
  colorSnake: "#8B5CF6",
};

const darkDraw = {
  sizeDotBorderRadius: 2,
  sizeCell: 14,
  sizeDot: 10,
  colorBackground: "#0d1117",
  colorDotBorder: "#1b1f230a",
  colorEmpty: "#161b22",
  colorDots: ["#161b22", "#0e4429", "#006d32", "#26a641", "#39d353"],
  colorSnake: "#8B5CF6",
};

const anim = { frameByStep: 1, stepDurationMs: 90 };

mkdirSync("dist", { recursive: true });

const { generateSnakeAnimation } = await import("generate-snake-animation");

console.log(`Generating profile-matched snake: ${FROM.slice(0, 10)} → ${TO.slice(0, 10)}`);
console.log(`Auth: ${process.env.CONTRIB_PAT ? "CONTRIB_PAT (includes private)" : "GITHUB_TOKEN (public only)"}`);

patchFetch(FROM, TO);

// Log how many days the snake will have (visible in Actions logs).
const probe = await originalFetch("https://api.github.com/graphql", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${TOKEN}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    query: `
      query ($login: String!, $from: DateTime!, $to: DateTime!) {
        user(login: $login) {
          contributionsCollection(from: $from, to: $to) {
            contributionCalendar {
              weeks { contributionDays { contributionCount date } }
            }
          }
        }
      }
    `,
    variables: { login: USER, from: FROM, to: TO },
  }),
});
const probeJson = await probe.json();
const days = probeJson.data?.user?.contributionsCollection?.contributionCalendar?.weeks
  ?.flatMap((w) => w.contributionDays)
  ?.filter((d) => d.contributionCount > 0) ?? [];
console.log(`Active contribution days for snake: ${days.length}`);
if (days.length < 10 && !process.env.CONTRIB_PAT) {
  console.warn(
    "WARN: Few public days detected. Profile may show more greens from PRIVATE repos. " +
      "Add repo secret CONTRIB_PAT (classic PAT, scope: read:user) then re-run workflow.",
  );
}

const results = await generateSnakeAnimation(
  { platform: "github", username: USER, githubToken: TOKEN },
  [
    {
      filename: "dist/snake.gif",
      format: "gif",
      drawOptions: lightDraw,
      animationOptions: anim,
    },
    {
      filename: "dist/snake-dark.gif",
      format: "gif",
      drawOptions: darkDraw,
      animationOptions: anim,
    },
    {
      filename: "dist/snake.svg",
      format: "svg",
      drawOptions: lightDraw,
      animationOptions: anim,
    },
    {
      filename: "dist/snake-dark.svg",
      format: "svg",
      drawOptions: darkDraw,
      animationOptions: anim,
    },
  ],
);

writeFileSync("dist/snake.gif", Buffer.from(results[0]));
writeFileSync("dist/snake-dark.gif", Buffer.from(results[1]));
writeFileSync("dist/snake.svg", results[2]);
writeFileSync("dist/snake-dark.svg", results[3]);

// README + legacy paths
const legacy = [
  ["dist/snake.gif", "dist/snake-2026.gif"],
  ["dist/snake-dark.gif", "dist/snake-2026-dark.gif"],
  ["dist/snake.svg", "dist/snake-2026.svg"],
  ["dist/snake-dark.svg", "dist/snake-2026-dark.svg"],
  ["dist/snake.gif", "dist/github-contribution-grid-snake.gif"],
  ["dist/snake-dark.gif", "dist/github-contribution-grid-snake-dark.gif"],
  ["dist/snake.svg", "dist/github-contribution-grid-snake.svg"],
  ["dist/snake-dark.svg", "dist/github-contribution-grid-snake-dark.svg"],
];
for (const [src, dest] of legacy) {
  copyFileSync(src, dest);
}

globalThis.fetch = originalFetch;
console.log("Done — profile-matched rolling-year snake generated.");
