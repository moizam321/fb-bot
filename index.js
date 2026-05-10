const express = require('express');
const axios = require('axios');
const dotenv = require('dotenv');
const session = require('express-session');

dotenv.config();
const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(session({
  secret: process.env.SESSION_SECRET || 'secret-key',
  resave: false,
  saveUninitialized: true
}));

// Health check
app.get('/health', (req, res) => res.send('OK'));

// Webhook Verification (Facebook requirement)
app.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  if (mode === 'subscribe' && token === process.env.WEBHOOK_VERIFY_TOKEN) {
    res.status(200).send(challenge);
  } else {
    res.sendStatus(403);
  }
});

// Receive Webhooks
app.post('/webhook', async (req, res) => {
  const body = req.body;
  if (body.object === 'page') {
    body.entry.forEach(async (entry) => {
      const pageId = entry.id;
      entry.changes.forEach(async (change) => {
        if (change.value.item === 'comment' && change.value.verb === 'add') {
          const commentId = change.value.comment_id;
          const accessToken = process.env.FACEBOOK_PAGE_ACCESS_TOKEN;
          try {
            // Reply publicly
            await axios.post(`https://graph.facebook.com/v25.0/${commentId}/comments`, 
              { message: 'Thank you for your comment! Check your DMs.' },
              { params: { access_token: accessToken } }
            );
            // Send Private DM
            await axios.post(`https://graph.facebook.com/v25.0/${pageId}/messages`,
              { recipient: { comment_id: commentId }, message: { text: 'Hi! How can we help you?' } },
              { params: { access_token: accessToken } }
            );
          } catch (e) { console.error('Error:', e.response?.data || e.message); }
        }
      });
    });
    res.sendStatus(200);
  } else { res.sendStatus(404); }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
