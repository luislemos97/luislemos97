// update-readme.js
const fs = require('fs');
const path = './README.md';

const token = process.env.GH_TOKEN;
if (!token) {
  console.error('ERRO: variável de ambiente GH_TOKEN não encontrada. Defina o secret GH_TOKEN no repositório.');
  process.exit(1);
}

const headersRest = {
  'Authorization': `token ${token}`,
  'User-Agent': 'update-readme-script',
  'Accept': 'application/vnd.github.v3+json'
};

const headersGraph = {
  'Authorization': `bearer ${token}`,
  'Content-Type': 'application/json',
  'User-Agent': 'update-readme-script'
};

async function graphql(query, variables = {}) {
  const res = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers: headersGraph,
    body: JSON.stringify({ query, variables })
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GraphQL request failed: ${res.status} ${res.statusText}\n${text}`);
  }
  return res.json();
}

async function getContributionTotals(username) {
  const now = new Date();
  const from = new Date(now.getFullYear(), 0, 1).toISOString();
  const to = new Date(now.getFullYear(), 11, 31, 23, 59, 59).toISOString();

  const q = `
    query($login:String!, $from:DateTime!, $to:DateTime!) {
      user(login: $login) {
        contributionsCollection(from: $from, to: $to) {
          totalCommitContributions
          totalIssueContributions
          totalPullRequestContributions
          contributionCalendar { totalContributions }
        }
      }
    }
  `;

  const resp = await graphql(q, { login: username, from, to });
  if (resp.errors) throw new Error('GraphQL errors: ' + JSON.stringify(resp.errors));
  const cc = resp.data.user.contributionsCollection;
  return {
    commits: cc.totalCommitContributions || 0,
    prs: cc.totalPullRequestContributions || 0,
    issues: cc.totalIssueContributions || 0,
    contributedLastYear: cc.contributionCalendar?.totalContributions || 0
  };
}

async function sumAllStars() {
  let page = 1;
  let totalStars = 0;

  while (true) {
    const res = await fetch(`https://api.github.com/user/repos?per_page=100&page=${page}`, {
      method: 'GET',
      headers: headersRest
    });
    if (!res.ok) {
      const t = await res.text();
      throw new Error(`GET /user/repos failed: ${res.status} ${res.statusText}\n${t}`);
    }
    const repos = await res.json();
    if (!Array.isArray(repos) || repos.length === 0) break;
    for (const r of repos) {
      totalStars += r.stargazers_count || 0;
    }
    page++;
  }

  return totalStars;
}

function buildBadgeBlock(stats) {
  // escape numbers in case (just convert to string)
  const commits = String(stats.commits);
  const prs = String(stats.prs);
  const issues = String(stats.issues);
  const stars = String(stats.stars);
  const contributed = String(stats.contributedLastYear);

  return `
<!--START_SECTION:stats-->
<div align="center">

![Commits](https://img.shields.io/badge/Commits-${commits}-red?logo=github)
![Pull Requests](https://img.shields.io/badge/PRs-${prs}-blue?logo=github)
![Issues](https://img.shields.io/badge/Issues-${issues}-green?logo=github)
![Stars](https://img.shields.io/badge/Stars-${stars}-yellow?logo=github)

**Contributions this year:** ${contributed}

</div>
<!--END_SECTION:stats-->
`;
}

async function main() {
  try {
    // infer username from token (GET /user)
    const userRes = await fetch('https://api.github.com/user', { headers: headersRest });
    if (!userRes.ok) {
      const t = await userRes.text();
      throw new Error(`GET /user failed: ${userRes.status} ${userRes.statusText}\n${t}`);
    }
    const user = await userRes.json();
    const username = user.login;
    console.log('Usuário autenticado:', username);

    const contribs = await getContributionTotals(username);
    console.log('Contribuições (este ano):', contribs);

    const stars = await sumAllStars();
    console.log('Total stars (todos os repositórios):', stars);

    const stats = {
      commits: contribs.commits,
      prs: contribs.prs,
      issues: contribs.issues,
      contributedLastYear: contribs.contributedLastYear,
      stars
    };

    let readme = fs.readFileSync(path, 'utf8');

    const startTag = '<!--START_SECTION:stats-->';
    const endTag = '<!--END_SECTION:stats-->';

    if (!readme.includes(startTag) || !readme.includes(endTag)) {
      console.error('README.md não contém os marcadores <!--START_SECTION:stats--> e <!--END_SECTION:stats-->');
      process.exit(1);
    }

    const newBlock = buildBadgeBlock(stats);
    const regex = new RegExp(`${startTag}[\\s\\S]*?${endTag}`, 'm');
    const updated = readme.replace(regex, newBlock);

    fs.writeFileSync(path, updated, 'utf8');
    console.log('README.md atualizado com sucesso.');
  } catch (err) {
    console.error('Erro ao atualizar README:', err);
    process.exit(1);
  }
}

main();
