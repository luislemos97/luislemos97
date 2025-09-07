const fs = require("fs");
const fetch = require("node-fetch");

const username = "luislemos97"; // seu usuário GitHub
const readmePath = "./README.md";

async function fetchGitHubData() {
const headers = { 
  "User-Agent": "update-readme-script",
  "Authorization": `token ${process.env.GH_TOKEN}`
};
  
  const [commits, issues, pulls, repos] = await Promise.all([
    fetch(`https://api.github.com/search/commits?q=author:${username}`, { headers }).then(r => r.json()),
    fetch(`https://api.github.com/search/issues?q=author:${username}+type:issue`, { headers }).then(r => r.json()),
    fetch(`https://api.github.com/search/issues?q=author:${username}+type:pr`, { headers }).then(r => r.json()),
    fetch(`https://api.github.com/users/${username}/repos?per_page=100`, { headers }).then(r => r.json()),
  ]);

  const stars = repos.reduce((acc, repo) => acc + (repo.stargazers_count || 0), 0);

  return {
    commits: commits.total_count || 0,
    issues: issues.total_count || 0,
    pulls: pulls.total_count || 0,
    stars,
  };
}

async function updateReadme() {
  const stats = await fetchGitHubData();
  let readme = fs.readFileSync(readmePath, "utf-8");

  const start = "<!--START_SECTION:stats-->";
  const end = "<!--END_SECTION:stats-->";

  const replacement = `
<div align="center">

![Commits](https://img.shields.io/badge/Commits-${stats.commits}-red?logo=github)
![Pull Requests](https://img.shields.io/badge/PRs-${stats.pulls}-blue?logo=github)
![Issues](https://img.shields.io/badge/Issues-${stats.issues}-green?logo=github)
![Stars](https://img.shields.io/badge/Stars-${stats.stars}-yellow?logo=github)

</div>
`;

  const regex = new RegExp(`${start}[\\s\\S]*?${end}`, "m");
  readme = readme.replace(regex, `${start}\n${replacement}\n${end}`);

  fs.writeFileSync(readmePath, readme);
}

updateReadme();
