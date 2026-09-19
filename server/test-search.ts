import { searchProducts } from './src/modules/product/product.search';

async function main() {
  const res = await searchProducts({ query: 'Shubha' });
  console.log(JSON.stringify(res, null, 2));
}

main().catch(console.error).finally(() => process.exit(0));
