const { toZonedTime, format: formatTz } = require('date-fns-tz');

function getNowInTimezone(timezone = 'Asia/Kolkata') {
  const now = new Date();
  const zonedNow = toZonedTime(now, timezone);
  const currentDate = formatTz(zonedNow, 'yyyy-MM-dd', { timeZone: timezone });
  const currentTime = formatTz(zonedNow, 'HH:mm:ss', { timeZone: timezone });

  return {
    now,
    zonedNow,
    currentDate,
    currentTime,
    formattedDisplay: formatTz(zonedNow, 'dd MMM yyyy, hh:mm:ss a zzz', { timeZone: timezone }),
  };
}

console.log('Result for Asia/Kolkata:', getNowInTimezone('Asia/Kolkata'));
console.log('Current UTC Time:', new Date().toISOString());
