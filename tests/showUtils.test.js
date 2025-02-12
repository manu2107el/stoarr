const showUtils = require("../src/showUtils");

test("unsupported platform", () => {
  expect(() =>
    showUtils.determinPlatform("http://youtube.com/slug/2343"),
  ).toThrow(/Unsupported/);
});
test("aniworld", () => {
  expect(showUtils.determinPlatform("http://aniworld.to/slug/2343")).toMatch(
    "https://aniworld.to/",
  );
});
test("s.to", () => {
  expect(showUtils.determinPlatform("http://s.to/slug/2343")).toMatch(
    "https://s.to/",
  );
});
test("getFullShow Structure", async () => {
  const showData = await showUtils.getFullShow(
    "https://aniworld.to/anime/stream/solo-leveling",
  );
  expect(showData).toBeInstanceOf(Array);
  showData.forEach((season) => {
    expect(season).toEqual(
      expect.objectContaining({
        season: expect.any(Number),
        seasonurl: expect.any(String),
        episodes: expect.any(Array),
      }),
    );

    season.episodes.forEach((episode) => {
      expect(episode).toEqual(
        expect.objectContaining({
          season: expect.any(Number),
          episode: expect.any(Number),
          videoUrl: expect.any(String),
        }),
      );
    });
  });
});
test("getFullShow invalidurl", async () => {
  await expect(
    showUtils.getFullShow("https://aniworld.to/animesteam/soloveling"),
  ).rejects.toThrow(/Error/);
});

test("getSeasonLinks Structure", async () => {
  const seasons = await showUtils.getSeasonLinks(
    "https://aniworld.to/anime/stream/solo-leveling",
  );

  seasons.forEach((season) => {
    expect(season).toEqual(
      expect.objectContaining({
        season: expect.any(Number),
        url: expect.any(String),
      }),
    );
  });
});
test("getSeasonLinks invalidurl", async () => {
  await expect(
    showUtils.getSeasonLinks("https://aniworld.to/animesteam/soloveling"),
  ).rejects.toThrow(/Error/);
});

test("getSeasonVideoUrls Structure", async () => {
  const season = await showUtils.getSeasonVideoUrls(
    "https://aniworld.to/anime/stream/solo-leveling",
  );

  season.forEach((episode) => {
    expect(episode).toEqual(
      expect.objectContaining({
        season: expect.any(Number),
        episode: expect.any(Number),
        videoUrl: expect.any(String),
      }),
    );
  });
});
test("getSeasonVideoUrls invalidurl", async () => {
  await expect(
    showUtils.getSeasonVideoUrls("https://aniworld.to/animesteam/soloveling"),
  ).rejects.toThrow(/Error/);
});
