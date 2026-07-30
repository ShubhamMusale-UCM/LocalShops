import { cacheDeletePattern } from "./src/config/redis"; cacheDeletePattern("shops:nearby:*").then(()=>console.log("cleared")).catch(console.error);
