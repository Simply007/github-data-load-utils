const octokit = require('@octokit/rest')();
const Json2csvParser = require('json2csv').Parser;
const fs = require('fs');

const getArrayDataFromMembersResponse = (response) => {
  return response.data;
}

const getArrayDataFromPullrequestResponse = (response) => {
  return response.data.items;
}

const paginate = async (octokit, method, parameters, getDataFromResponse) => {
  let response = await method({ ...parameters, per_page: 100, page: 1 });
  let data = getDataFromResponse(response);
  while (octokit.hasNextPage(response)) {
    response = await octokit.getNextPage(response);
    data = data.concat(getDataFromResponse(response));
  }
  return data;
};


const getPullRequests = async () => await paginate(
  octokit,
  octokit.search.issues,
  {
    q: 'is:pr org:Kentico created:2018-10-01..2018-10-31 -label:invalid is:public',
    sort: 'created',
    order: 'desc'
  },
  getArrayDataFromPullrequestResponse
);

const getKenticoOrgMembers = async () => await paginate(
  octokit,
  octokit.orgs.getMembers,
  {
    org: "Kentico"
  },
  getArrayDataFromMembersResponse
);



const getHacktoberfestPullRequests = async () => {
  const kenticoUsers = await getKenticoOrgMembers();
  const kenticoLogins = kenticoUsers.map(user => user.login);
  const pullRequests = await getPullRequests();
  return pullRequests.filter(request => !kenticoLogins.includes(request.user.login))
}

/**
 * 
 * Get the access key and query github to load pull requests 
 * made between 1.10.2018 - 31.10.2018. 
 * Result is generated to the output.csv in current folder.
 * 
 * @param {string} accessToken access to be used while generating (require Kentico organization membership permission )
 */
const generateHacktoberfestOutput = async (accessToken) => {

  octokit.authenticate({
    type: 'token',
    token: accessToken
  });

  const kenticoUsers = await getKenticoOrgMembers();
  const pullRequests = await getPullRequests();
  
  const kenticoLogins = kenticoUsers.map(user => user.login);
  const externalPullRequests = pullRequests.filter(request => !kenticoLogins.includes(request.user.login));

  const projectedData = externalPullRequests.map(pullRequest => ({
    login: pullRequest.user.login,
    loginUrl: pullRequest.user.html_url,
    pullRequestUrl: pullRequest.html_url
  }));

  const fields = Object.keys(projectedData[0]);
  const json2csvParser = new Json2csvParser({ fields, delimiter: ';' });
  const csv = json2csvParser.parse(projectedData);
  
  fs.writeFile("./output.csv", csv, (err) => console.log(err));
}

module.exports = {
  generateHacktoberfestOutput
}
