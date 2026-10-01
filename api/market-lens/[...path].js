import marketLensHandler from '../../market-lens/api/[...path].js';

export default async function handler(request, response) {
  const requestUrl = new URL(request.url, `https://${request.headers.host || 'localhost'}`);
  requestUrl.pathname = requestUrl.pathname.replace(/^\/api\/market-lens(?=\/)/, '/api');
  const proxiedRequest = Object.create(request);
  proxiedRequest.url = `${requestUrl.pathname}${requestUrl.search}`;
  return marketLensHandler(proxiedRequest, response);
}