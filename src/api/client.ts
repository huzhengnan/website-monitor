import axios, { AxiosInstance } from 'axios';

const API_BASE_URL = '/api';

const client: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 300000, // 5分钟超时，足够处理 GA4 导入
  headers: {
    'Content-Type': 'application/json',
  },
});

client.interceptors.request.use(
  (config) => {
    console.log(`[API] ${config.method?.toUpperCase()} ${config.url}`);
    return config;
  },
  (error) => {
    console.error('Request error:', error);
    return Promise.reject(error);
  }
);

client.interceptors.response.use(
  (response) => {
    console.log(`[API] Response ${response.status} from ${response.config.url}`);
    // Return response.data which contains the API response
    return response.data;
  },
  (error) => {
    if (error.response) {
      const url = error.response?.config?.url || '';
      const msg = error.response?.data?.error || error.response?.statusText || 'No error message';
      console.error(`[API Error] ${error.response.status} - ${url} - ${msg}`);
    } else if (error.request) {
      console.error('[API Error] No response from server');
    } else {
      console.error('[API Error]', error.message);
    }
    return Promise.reject(error);
  }
);

export default client;
