docker compose up -d postgres redis

npm run server:dev   
npm run dev --workspace=server

npm run mobile:start -- --tunnel
npm run mobile:start -- --clear
npm run mobile:android
npm run mobile:web