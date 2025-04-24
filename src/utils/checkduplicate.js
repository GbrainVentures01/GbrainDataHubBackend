const moment = require("moment");

function isLessThan90Seconds(createdAt) {
  if (!createdAt) throw new Error("createdAt is required");
  const now = moment();
  const differenceInSeconds = moment.duration(now.diff(createdAt)).asSeconds();
  console.log("differenceInSeconds", differenceInMinutes);
  return differenceInSeconds < 90;
}

module.exports = async (id, data, collectionName) => {
  if (!id) throw new Error("id is required");
  if (!data) throw new Error("data is required");
  if (!collectionName) throw new Error("collectionName is required");
  const lastTransaction = await strapi.query(collectionName).findMany({
    orderBy: { createdAt: "DESC" },
    where: {
      user: id,
    },
    limit: 1,
  });
  console.log(lastTransaction);
  if (lastTransaction.length > 0) {
    if (isLessThan90Seconds(lastTransaction[0].createdAt)) {
      if (
        Number(lastTransaction[0].amount) === Number(data.amount) ||
        lastTransaction[0].beneficiary === data.beneficiary
      ) {
        return true;
      } else {
        return false;
      }
    } else {
      return false;
    }
  }
  return false;
};
