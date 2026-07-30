const { searchProducts } = require('./src/modules/product/product.search.ts');

searchProducts({ latitude: 12.9716, longitude: 77.5946, radius: 50 }).then((res: any) => {
  console.log(JSON.stringify(res, null, 2));
}).catch(console.error);