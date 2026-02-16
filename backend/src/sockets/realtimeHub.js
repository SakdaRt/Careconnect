let ioInstance = null;

export function setSocketServer(io) {
  ioInstance = io;
}

export function emitToUserRoom(userId, event, payload) {
  if (!ioInstance || !userId || !event) return;
  ioInstance.to(`user:${userId}`).emit(event, payload);
}
