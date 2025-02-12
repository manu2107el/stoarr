var { JSDOM } = require("jsdom");

function determinPlatform(url) {
  if (url.includes("aniworld.to")) {
    return "https://aniworld.to/";
  } else if (url.includes("s.to")) {
    return "https://s.to/";
  } else {
    throw new Error(
      "Unsupported website. Please provide an aniworld.to or s.to link.",
    );
  }
}

async function getFullShow(seriesURL) {
  const seasons = await getSeasonLinks(seriesURL);
  const show = await Promise.all(
    seasons.map(async (season) => {
      return {
        season: season.season,
        seasonurl: season.url,
        episodes: await getSeasonVideoUrls(season.url),
      };
    }),
  );

  return show;
}

async function getSeasonLinks(seriesURL) {
  const originUrl = determinPlatform(seriesURL);

  const seriesResponse = await fetch(seriesURL);
  if (!seriesResponse.ok) {
    throw new Error(
      `Failed to fetch ${seriesURL}: ${seriesResponse.status} ${seriesResponse.statusText}`,
    );
  }

  const seriesHtml = await seriesResponse.text();
  const dom = new JSDOM(seriesHtml);
  const document = dom.window.document;

  const potentialSeasonLinks = Array.from(
    document.querySelectorAll('a[href*="staffel"]'),
  )
    .map((link) => {
      const href = link.getAttribute("href");
      if (!href) return null;
      return href.startsWith("http")
        ? href
        : originUrl + href.replace(/^\//, "");
    })
    .filter((link) => link);

  const seasonLinks = [];
  const seenLinks = new Set(); // Use a Set to track seen links

  for (const link of potentialSeasonLinks) {
    const staffelRegex = /staffel-(\d+)$/; // Capture the season number
    const match = link.match(staffelRegex); // Use match to get the captured group

    if (match && !seenLinks.has(link)) {
      const seasonNumber = parseInt(match[1], 10); // Parse the captured number as an integer
      seasonLinks.push({
        season: seasonNumber,
        url: link,
      });
      seenLinks.add(link);
    }
  }

  // Sort by season number (important if order matters)
  seasonLinks.sort((a, b) => a.season - b.season);

  if (seasonLinks.length === 0) {
    throw new Error(`No seasons found on ${seriesURL}`);
  }

  return seasonLinks;
}

async function getSeasonVideoUrls(seasonURL) {
  const originUrl = determinPlatform(seasonURL);

  const htmlResponse = await fetch(seasonURL);
  if (!htmlResponse.ok) {
    throw new Error(
      `Failed to fetch ${seasonURL}: ${htmlResponse.status} ${htmlResponse.statusText}`,
    );
  }
  const html = await htmlResponse.text();
  const dom = new JSDOM(html);
  const document = dom.window.document;

  const episodeLinks = Array.from(
    document.querySelectorAll('ul > li > a[href*="episode"]'),
  );

  const episodeUrls = episodeLinks
    .map((link) => {
      const href = link.getAttribute("href");
      if (!href || href.indexOf("/stream/") < 0) return null;
      return href.startsWith("http")
        ? href
        : originUrl + href.replace(/^\//, "");
    })
    .filter((url) => url);

  if (episodeUrls.length <= 0) {
    throw new Error(`Could not retrieve episode list from url: ${seasonURL}`);
  }

  const videoURLRegex =
    /<a\s+[^>]*class="[^"]*watchEpisode[^"]*"[^>]*href="([^"]*)"/i;
  const seasonNumberRegex =
    /<meta\s+itemprop="seasonNumber"\s+content="([^"]*)"/i;
  const episodeNumberRegex = /<meta\s+itemprop="episode"\s+content="([^"]*)"/i;

  const results = await Promise.all(
    episodeUrls.map(async (url) => {
      const episodeResponse = await fetch(url);
      if (!episodeResponse.ok) {
        throw new Error(
          `Failed to fetch ${url}: ${episodeResponse.status} ${episodeResponse.statusText}`,
        );
      }
      const episodeBody = await episodeResponse.text();

      const urlMatch = episodeBody.match(videoURLRegex);
      const seasonMatch = episodeBody.match(seasonNumberRegex);
      const episodeMatch = episodeBody.match(episodeNumberRegex);

      // if (episodeMatch && episodeMatch[1] === "1") { //For debugging only
      //    fs.writeFileSync("body.html", episodeBody);
      // }

      if (urlMatch && seasonMatch && episodeMatch) {
        return {
          // Return an object for clarity
          season: parseInt(seasonMatch[1]),
          episode: parseInt(episodeMatch[1]),
          videoUrl: originUrl + urlMatch[1],
        };
      }
      return null;
    }),
  );

  const videoURLs = results.filter((result) => result);

  if (videoURLs.length <= 0) {
    throw new Error("Could not retrieve video URLs!");
  }

  videoURLs.sort((a, b) => parseInt(a.episode, 10) - parseInt(b.episode, 10)); // Sort by episode

  return videoURLs; // Return the array of video URL objects
}

module.exports = {
  getSeasonVideoUrls,
  getSeasonLinks,
  getFullShow,
  determinPlatform,
};
