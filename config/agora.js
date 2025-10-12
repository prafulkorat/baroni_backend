import pkg from 'agora-access-token';
const { RtmTokenBuilder, RtmRole } = pkg;

const AGORA_APP_ID = process.env.AGORA_APP_ID;
const AGORA_APP_CERTIFICATE = process.env.AGORA_APP_CERTIFICATE;
const AGORA_TOKEN_EXPIRATION = 3600; // Token valid for 1 hour

export function GenerateRtmAgoraToken(userId) {
    console.log('Generating RTM token for user:', userId);
  const expirationTimeInSeconds = 3600; // 1 hour
  const currentTimestamp = Math.floor(Date.now() / 1000);
  const privilegeExpiredTs = currentTimestamp + expirationTimeInSeconds;

  const token = RtmTokenBuilder.buildToken(
    AGORA_APP_ID,
    AGORA_APP_CERTIFICATE,
    userId,
    RtmRole.Rtm_User,
    privilegeExpiredTs
  );

  return token;
}


// export function GenerateRtmAgoraToken(userAccount) {
//     // RTM tokens must be built with userAccount (string), not uid
//     return agora.RtmTokenBuilder.buildToken(
//         AGORA_APP_ID,
//         AGORA_APP_CERTIFICATE,
//         String(userAccount),
//         agora.RtmRole.Rtm_User,
//         0
//     );
// }

export function GenerateRtcAgoraToken(userId, channelName) {
    return pkg.RtcTokenBuilder.buildTokenWithUid(
        AGORA_APP_ID,
        AGORA_APP_CERTIFICATE,
        channelName,
        userId,
        pkg.RtcRole.PUBLISHER,
        0
    );
}

