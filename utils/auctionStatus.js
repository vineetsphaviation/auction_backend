export const getAuctionStatus = (
  auction,
  now = new Date()
) => {

  if (now < auction.startTime) {
    return "SCHEDULED";
  }

  if (
    now >= auction.startTime &&
    now < auction.endTime
  ) {
    return "OPEN";
  }

  return "CLOSED";
};