# Reviews service

Small standalone Express service to collect and serve reviews for GlobalChatroom.

Install and run locally:

```powershell
cd reviews_service
npm install
npm start
```

The service exposes:
- POST /submit JSON { rating, feedback, user }
- GET /reviews.json (returns array)
- Admin UI at / (static)

Deploy this as a separate service (Render/Heroku) and point your client to its `/submit` endpoint.
