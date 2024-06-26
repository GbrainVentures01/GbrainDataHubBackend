const moment = require("moment");

function isLessThanThreeMins(createdAt) {
  if (!createdAt) throw new Error("createdAt is required");
  const now = moment();
  const differenceInMinutes = moment.duration(now.diff(createdAt)).asMinutes();
  console.log("differenceInMinutes", differenceInMinutes);
  return differenceInMinutes < 3;
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
    if (isLessThanThreeMins(lastTransaction[0].createdAt)) {
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
