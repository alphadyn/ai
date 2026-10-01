import companiesHandler from '../../market-curve-lab/api/companies.js';
import searchHandler from '../../market-curve-lab/api/search.js';
import analysisHandler from '../../market-curve-lab/api/analysis.js';
import marketLensHandler from '../../market-lens/api/[...path].js';

const handlers = {
  companies: companiesHandler,
  search: searchHandler,
  analysis: analysisHandler,
};

export default async function handler(request, response) {
  const requestUrl = new URL(request.url, `https://${request.headers.host || 'localhost'}`);
  const lensPrefix = '/api/market-curve-lab/lens';
  if (requestUrl.pathname.startsWith(`${lensPrefix}/`)) {
    const proxiedRequest = Object.create(request);
    proxiedRequest.url = requestUrl.pathname.replace(lensPrefix, '/api') + requestUrl.search;
    return marketLensHandler(proxiedRequest, response);
  }
  const path = requestUrl.pathname.split('/').filter(Boolean).pop();
  const routeHandler = handlers[path];
  if (!routeHandler) {
    response.status(404).json({ error: 'Market data route not found.' });
    return;
  }
  return routeHandler(request, response);
}