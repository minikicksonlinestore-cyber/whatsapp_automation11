const tomorrow = new Date(Date.now() + 86400000);
const day = tomorrow.getDate();
const month = tomorrow.toLocaleString('en-GB', { month: 'short' });
const dateLabel = `${day} ${month} (Tomorrow)`;

const message = `${dateLabel}\n\nCarzo – Scripted 2\nDisxeno – Reel 4`;

console.log('Sending test message to TRENDHIVE group...');
console.log('Message:\n' + message + '\n');

fetch('http://localhost:3001/send-group', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-gateway-secret': 'baileys-local-secret',
  },
  body: JSON.stringify({
    groupId: '120363403007632805@g.us',
    message,
  }),
})
  .then(r => r.json())
  .then(res => {
    if (res.success) {
      console.log('✅ Message sent successfully!');
      console.log('Message ID:', res.messageId);
    } else {
      console.error('❌ Send failed:', res.error);
    }
  })
  .catch(err => console.error('❌ Gateway unreachable:', err.message));
