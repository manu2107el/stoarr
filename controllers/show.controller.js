const showUtils = require("../src/showUtils");
exports.getShow = async (req, res) => {
  if (req.body.type === null || req.body.type === undefined) {
    res.status(400).send({ message: "type Required" });
  }
  if (req.body.link === null || req.body.link === undefined) {
    res.status(400).send({ message: "link Required" });
  }
  try {
    switch (req.body.type) {
      case "full":
        const fullResult = await showUtils.getFullShow(req.body.link);
        res.status(200).send(fullResult);
        break;
      case "season":
        const seasonResult = await showUtils.getSeasonVideoUrls(req.body.link);
        res.status(200).send(seasonResult);
        break;
      default:
        res
          .status(400)
          .send({
            message: "invalid type specified. valid types are: full, season",
          });
    }
  } catch (error) {
    res.status(500).send({ message: error.message });
  }
};
