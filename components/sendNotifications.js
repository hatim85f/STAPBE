const { Expo } = require("expo-server-sdk");
const expo = new Expo();

const sendPushNotification = async (
  expoPushToken,
  title,
  routeValue,
  message
) => {
  let messages = [
    {
      to: expoPushToken,
      sound: "default",
      title: title,
      body: message,
      data: {
        route: routeValue,
      },
    },
  ];

  let chunks = expo.chunkPushNotifications(messages);

  for (let chunk of chunks) {
    try {
      let ticketChunk = await expo.sendPushNotificationsAsync(chunk);
    } catch (error) {
      console.error(error);
    }
  }
};

module.exports = { sendPushNotification };
