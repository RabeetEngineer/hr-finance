import Seat from "../models/Seat.js";

export const syncSeatState = (seatDoc) => {
  if (!seatDoc) return "vacant";
  if (seatDoc.seatStatus === "frozen") return "frozen";
  if (seatDoc.currentEmployee) return "occupied";
  if (seatDoc.additionalChargeHolder) return "additional_charge";
  return "vacant";
};

export const applySeatState = async (seatId, session = null) => {
  const seat = await Seat.findById(seatId).session(session);
  if (!seat) return null;
  seat.seatStatus = syncSeatState(seat);
  await seat.save({ session });
  return seat;
};

