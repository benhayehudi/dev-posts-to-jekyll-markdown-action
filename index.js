const { Toolkit } = require('actions-toolkit')
const dotenv = require("dotenv");
dotenv.config();
const axios = require('axios').default;
const btoa = require('btoa');

Toolkit.run(async tools => {

  // Print out the context in Actions dashboard
  console.log(tools.context);

  // Assign owner and repo data to variables
  const owner = tools.context.payload.repository.owner.login;
  const repo = tools.context.payload.repository.name;
  const repoSHA = tools.context.sha;
  // console.log(`THIS IS THE OWNER: ${owner} AND THIS IS THE REPO: ${repo}`);

  // Get Latest DEV Posts

  // Create DEV variables
  var devPosts; // All posts
  var devPostDate; // Date of most recently published DEV post
  var devPostTitle; // Title of most recently published DEV post
  var devPostCoverImage; // Cover Image of most recent published DEV post
  var devPostURL; // URL to most recently published DEV post
  var numOfDevPosts; // Count of DEV posts
  var headers = {
    "Content-Type": "application/json",
    "api-key": `${process.env.DEV_API_KEY}`
  }
  const getData = () => {
    return axios({
      method: 'get',
      url: 'https://dev.to/api/articles/me?page=1&per_page=6',
      headers: headers
    })
  };
  // Assign DEV data
  devPosts = (await getData()).data;
  devPostDate = devPosts[0]['published_at']; // ex. 2020-02-12T12:45:27.741Z
  devPostTitle = devPosts[0]['title'];
  devPostCoverImage = devPosts[0]['cover_image'];
  devPostURL = devPosts[0]['url'];
  // Count number of DEV posts
  numOfDevPosts = devPosts.length;

  // Repository _posts folder data

  // Get contents of _posts folder

  // Create variables
  var path = '_posts';
  var posts; // All posts in repo
  var postsCount; // Count of posts in repo
  var postTitle; // Latest repo post title
  var postDate; // Latest repo post date
  var lastPostPath; // Path to oldest repo post
  var lastPostSHA; // SHA for oldest repo post
  var newFile; // New Markdown File
  var refsData; // Data on Current Repo Refs
  var newBranch; // New Branch for PR
  var newPR; // New Pull Request
  var newJekyllPostFileName; // File name for new Jekyll post

  // Get repo posts data
  posts = (await tools.github.repos.getContents({
    owner,
    repo,
    path
  })).data;

  // Count the number of posts in repo posts folder 
  postsCount = posts.length;

  // Get the date and title of latest blog post in repo
  postTitle = posts[0]["name"].slice(11).split('.')[0].split('-').join(' ');
  postDate = posts[0]["name"].slice(0,10);

  // Get the path to the last blog post in repo
  lastPostPath = posts[postsCount -1]["path"];

  // Get SHA of last repo post
  lastPostSHA = posts[postsCount -1]["sha"];

  // Format file name for possible new blog post
  newJekyllPostFileName = `${devPostDate.split('T')[0]}-${devPostTitle.toLowerCase().split(' ').join('-')}.md`;

  // Check to see if the latest DEV post is newer than the latest repo post
  if (new Date(devPostDate) >= new Date(postDate)) {
    console.log("dev date is newer");
    // Is there more or equal num posts in the repo than the number of posts set by env var and
    // Is there less posts in the repo than the amount of DEV posts?
    if ((postsCount >= process.env.NUM_OF_POSTS) && (postsCount < numOfDevPosts)) {
      console.log("there are more repo posts than set by env var & less repo posts then on DEV");
    } else if ((postsCount < process.env.NUM_OF_POSTS) && (numOfDevPosts > postsCount)) {
      // Is there less posts in the repo than # set by env var and more posts in DEV posts count?
      console.log("there are less repo posts than set by env var & more DEV posts than in repo");

      // Create Markdown File
      fileContents = `
      ---
      layout: defaults
      modal-id: ${postsCount+1}
      date: ${devPostDate}
      img: ${devPostCoverImage}
      alt: Cover Image
      title: ${devPostTitle}
      link: ${devPostURL}
      
      ---
      `.trim();

      // Encode it in Base64 Encoding
      const encodedContents = btoa(fileContents);

      // Check if Branch Already Exists
      refsData = (await tools.github.git.listRefs({
        owner,
        repo
      })).data;

      // If branch does not exist, create branch
      if (refsData.filter(data => (data.ref == 'refs/heads/dev_to_jekyll')).length == 0) {
        // Create a New Branch for the PR
        newBranch = (await tools.github.git.createRef({
          owner,
          repo,
          ref: 'refs/heads/dev_to_jekyll',
          sha: repoSHA
        }));
      };

      // Add Markdown File

      // If file already exists, modify it with latest changes
      var currentPostArr = posts.filter(post => (post.name == newJekyllPostFileName));
      if (currentPostArr.length > 0) {
        console.log(`HERE IS POST: ${currentPostArr[0]}`);
        var currentPostSHA;
        currentPostSHA = post[0].sha;
        newFile = (await tools.github.repos.createOrUpdateFile({
          owner,
          repo,
          branch: 'dev_to_jekyll',
          path: `_posts/${newJekyllPostFileName}`,
          message: `New markdown file for ${devPostTitle}`,
          content: encodedContents,
          sha: currentPostSHA
        }));
      } else {
        // If file doesn't already exist, create it as new
        newFile = (await tools.github.repos.createOrUpdateFile({
          owner,
          repo,
          branch: 'dev_to_jekyll',
          path: `_posts/${devPostDate.split('T')[0]}-${devPostTitle.toLowerCase().split(' ').join('-')}.md`,
          message: `New markdown file for ${devPostTitle}`,
          content: encodedContents
        }));
      }

      // Create Pull Request
      newPR = (await tools.github.pulls.create({
        owner,
        repo,
        title: `New DEV Post: ${devPostTitle}`,
        head: 'dev_to_jekyll',
        base: 'master',
        body: `Automated PR to add the new DEV blog post, ${devPostTitle}, to your Jekyll site as markdown.`
      }));
    };
  };
});
