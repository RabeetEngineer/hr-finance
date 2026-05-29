import PostingHistory from "../models/PostingHistory.js";

export const recordPostingHistory = async ({
  employee,
  actionType,
  fromWing = null,
  fromOfficeSection = null,
  fromSeat = null,
  toWing = null,
  toOfficeSection = null,
  toSeat = null,
  effectiveDate = new Date(),
  orderNumber = "",
  remarks = "",
  session = null,
}) => {
  const history = await PostingHistory.create(
    [
      {
        employee,
        actionType,
        fromWing,
        fromOfficeSection,
        fromSeat,
        toWing,
        toOfficeSection,
        toSeat,
        effectiveDate,
        orderNumber,
        remarks,
      },
    ],
    session ? { session } : undefined
  );

  return history[0];
};

